package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

func main() {
	root := flag.String("root", "", "directory containing the presenter static site (must include index.html)")
	addr := flag.String("addr", "127.0.0.1:0", "listen address (loopback only)")
	openBrowser := flag.Bool("open", false, "open the presenter URL in the default browser")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: server --root <dir> [--addr 127.0.0.1:0] [--open]\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	if *root == "" {
		flag.Usage()
		os.Exit(1)
	}

	absRoot, err := filepath.Abs(*root)
	if err != nil {
		fmt.Fprintf(os.Stderr, "The presenter files are missing: %s/index.html. Unpack the whole folder, then start again.\n", *root)
		os.Exit(1)
	}
	info, err := os.Stat(absRoot)
	if err != nil || !info.IsDir() {
		fmt.Fprintf(os.Stderr, "The presenter files are missing: %s/index.html. Unpack the whole folder, then start again.\n", absRoot)
		os.Exit(1)
	}
	indexPath := filepath.Join(absRoot, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		fmt.Fprintf(os.Stderr, "The presenter files are missing: %s/index.html. Unpack the whole folder, then start again.\n", absRoot)
		os.Exit(1)
	}

	host, _, err := net.SplitHostPort(*addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid --addr %q: %v\n", *addr, err)
		os.Exit(1)
	}
	if !isLoopbackHost(host) {
		fmt.Fprintf(os.Stderr, "listen address must use a loopback host (127.0.0.1, ::1, or localhost), got %q\n", host)
		os.Exit(1)
	}

	fsys := os.DirFS(absRoot)
	srv := &http.Server{
		Handler:      &fileHandler{root: absRoot, fsys: fsys},
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}
	tcpAddr, ok := ln.Addr().(*net.TCPAddr)
	if !ok {
		fmt.Fprintf(os.Stderr, "unexpected listener address type\n")
		os.Exit(1)
	}
	boundPort := tcpAddr.Port
	presentURL := presenterURL(host, boundPort)

	fmt.Println("Web Slider presenter is running.")
	fmt.Printf("Open this link in your browser: %s\n", presentURL)
	fmt.Println("Leave this window open while you present. Close it to stop the presenter.")

	if *openBrowser {
		if err := openURL(presentURL); err != nil {
			fmt.Printf("The browser did not open by itself (%v). Open the link above.\n", err)
		}
	}

	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			fmt.Fprintf(os.Stderr, "server: %v\n", err)
			os.Exit(1)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	fmt.Println("Presenter stopped.")
	os.Exit(0)
}

func isLoopbackHost(host string) bool {
	switch strings.ToLower(host) {
	case "127.0.0.1", "::1", "localhost":
		return true
	default:
		return false
	}
}

func presenterURL(host string, port int) string {
	switch strings.ToLower(host) {
	case "::1":
		return fmt.Sprintf("http://[::1]:%d/", port)
	default:
		return fmt.Sprintf("http://127.0.0.1:%d/", port)
	}
}

func openURL(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	if err := cmd.Wait(); err != nil {
		return err
	}
	return nil
}

type fileHandler struct {
	root string
	fsys fs.FS
}

func (h *fileHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "Method not allowed.", http.StatusMethodNotAllowed)
		return
	}

	urlPath := r.URL.Path
	if urlPath == "" {
		urlPath = "/"
	}

	rel, err := urlToRelPath(urlPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Not found: %s", urlPath), http.StatusNotFound)
		return
	}

	servePath, fileInfo, err := resolveFile(h.fsys, rel)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			http.Error(w, fmt.Sprintf("Not found: %s", urlPath), http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("Not found: %s", urlPath), http.StatusNotFound)
		return
	}

	ctype := contentTypeForPath(servePath)
	w.Header().Set("Content-Type", ctype)

	if r.Method == http.MethodHead {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size()))
		return
	}

	diskPath := filepath.Join(h.root, filepath.FromSlash(servePath))
	diskFile, err := os.Open(diskPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Not found: %s", urlPath), http.StatusNotFound)
		return
	}
	defer diskFile.Close()
	http.ServeContent(w, r, filepath.Base(servePath), fileInfo.ModTime(), diskFile)
}

func urlToRelPath(urlPath string) (string, error) {
	if !strings.HasPrefix(urlPath, "/") {
		return "", fs.ErrNotExist
	}
	rest := strings.TrimPrefix(urlPath, "/")
	rest = strings.TrimSuffix(rest, "/")
	if rest == "" {
		return "index.html", nil
	}
	segments := strings.Split(rest, "/")
	for _, seg := range segments {
		if seg == "" {
			continue
		}
		if seg == ".." || seg == "." {
			return "", fs.ErrNotExist
		}
	}
	rel := filepath.ToSlash(filepath.Clean(rest))
	if rel == "." {
		return "index.html", nil
	}
	if strings.HasPrefix(rel, "../") || rel == ".." {
		return "", fs.ErrNotExist
	}
	if !fs.ValidPath(rel) {
		return "", fs.ErrNotExist
	}
	return rel, nil
}

func resolveFile(fsys fs.FS, rel string) (string, fs.FileInfo, error) {
	info, err := fs.Stat(fsys, rel)
	if err != nil {
		return "", nil, err
	}
	if info.IsDir() {
		indexRel := rel + "/index.html"
		if !fs.ValidPath(indexRel) {
			return "", nil, fs.ErrNotExist
		}
		indexInfo, err := fs.Stat(fsys, indexRel)
		if err != nil {
			return "", nil, fs.ErrNotExist
		}
		if indexInfo.IsDir() {
			return "", nil, fs.ErrNotExist
		}
		return indexRel, indexInfo, nil
	}
	return rel, info, nil
}

func contentTypeForPath(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".html":
		return "text/html; charset=utf-8"
	case ".js", ".mjs":
		return "text/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".json", ".map":
		return "application/json"
	case ".yaml", ".yml":
		return "text/yaml; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".ico":
		return "image/x-icon"
	case ".ttf":
		return "font/ttf"
	case ".otf":
		return "font/otf"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".zip":
		return "application/zip"
	case ".txt", ".md":
		return "text/plain; charset=utf-8"
	case ".wasm":
		return "application/wasm"
	default:
		return "application/octet-stream"
	}
}
