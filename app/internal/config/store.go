package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const (
	appDirName        = "simple-comfyui-gui"
	configFileName    = "config.json"
	defaultComfyUIURL = "http://localhost:8188"
)

type AppConfig struct {
	ComfyUIURL string `json:"comfyui_url"`
}

func DefaultConfig() AppConfig {
	return AppConfig{ComfyUIURL: defaultComfyUIURL}
}

func Load() (AppConfig, error) {
	configPath, err := getConfigPath()
	if err != nil {
		return DefaultConfig(), err
	}

	file, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return DefaultConfig(), nil
		}
		return DefaultConfig(), err
	}

	config := DefaultConfig()
	if err := json.Unmarshal(file, &config); err != nil {
		return DefaultConfig(), err
	}

	if config.ComfyUIURL == "" {
		config.ComfyUIURL = defaultComfyUIURL
	}

	return config, nil
}

func Save(config AppConfig) error {
	configDir, err := getConfigDir()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return err
	}

	encoded, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	configPath := filepath.Join(configDir, configFileName)
	return os.WriteFile(configPath, encoded, 0o644)
}

func getConfigDir() (string, error) {
	baseDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(baseDir, appDirName), nil
}

func getConfigPath() (string, error) {
	configDir, err := getConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, configFileName), nil
}
