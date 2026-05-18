package client

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"time"
)

type Client struct {
	baseURL    string
	rawToken   []byte
	httpClient *http.Client
	etag       string
}

type Option func(*Client)

func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.httpClient.Timeout = d
	}
}

func New(baseURL, rawToken string, opts ...Option) *Client {
	c := &Client{
		baseURL:  baseURL,
		rawToken: []byte(rawToken),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &retryTransport{
				base: &http.Transport{
					TLSClientConfig: &tls.Config{
						MinVersion: tls.VersionTLS13,
					},
					MaxIdleConns:       10,
					IdleConnTimeout:    90 * time.Second,
					DisableCompression: true,
				},
				maxRetries: 3,
				baseDelay:  500 * time.Millisecond,
			},
		},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

type BundleResponse struct {
	Body       []byte
	ETag       string
	StatusCode int
}

func (c *Client) FetchBundle() (*BundleResponse, error) {
	req, err := http.NewRequest("GET", c.baseURL+"/api/v1/bundle", nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+string(c.rawToken))
	if c.etag != "" {
		req.Header.Set("If-None-Match", c.etag)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch bundle: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotModified {
		return &BundleResponse{StatusCode: 304, ETag: c.etag}, nil
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("bundle request failed: %d %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	etag := resp.Header.Get("ETag")
	c.etag = etag

	return &BundleResponse{Body: body, ETag: etag, StatusCode: 200}, nil
}

func (c *Client) Close() {
	for i := range c.rawToken {
		c.rawToken[i] = 0
	}
	runtime.KeepAlive(c.rawToken)
}

func (c *Client) Ping() error {
	req, err := http.NewRequest("HEAD", c.baseURL+"/api/v1/bundle", nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+string(c.rawToken))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("ping: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotModified {
		return fmt.Errorf("ping failed: status %d", resp.StatusCode)
	}
	return nil
}
