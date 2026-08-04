import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/models/auth_session.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../network/api_client.dart';
import '../domain/login_request.dart';
import 'auth_service.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    service: ref.watch(authServiceProvider),
    storage: ref.watch(secureStorageProvider),
  ),
);

class AuthRepository {
  const AuthRepository({required this._service, required this._storage});

  final AuthService _service;
  final SecureStorageService _storage;

  Future<AuthSession> login(LoginRequest request) async {
    final session = await _service.login(request);
    await _storage.write(AppConstants.authTokenKey, session.token);
    return session;
  }

  Future<AuthSession> register({
    required String email,
    required String password,
    required String fullName,
  }) async {
    final session = await _service.register(
      email: email,
      password: password,
      fullName: fullName,
    );
    await _storage.write(AppConstants.authTokenKey, session.token);
    return session;
  }

  Future<void> logout() => _storage.delete(AppConstants.authTokenKey);

  Future<String?> readToken() => _storage.read(AppConstants.authTokenKey);
}
