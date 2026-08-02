import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/secure_storage_service.dart';
import '../../../network/api_client.dart';

const _themeModeKey = 'theme_mode';

final settingsStorageProvider = Provider<SettingsStorage>(
  (ref) => SettingsStorage(ref.watch(secureStorageProvider)),
);

class SettingsStorage {
  const SettingsStorage(this._storage);

  final SecureStorageService _storage;

  Future<ThemeMode> readThemeMode() async {
    final raw = await _storage.read(_themeModeKey);
    return switch (raw) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> saveThemeMode(ThemeMode mode) {
    final raw = switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    };

    return _storage.write(_themeModeKey, raw);
  }
}
