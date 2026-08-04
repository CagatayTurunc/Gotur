import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/auth_session.dart';
import '../data/auth_repository.dart';
import '../data/auth_service.dart';
import '../domain/login_request.dart';

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession?>(AuthController.new);

class AuthController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() async {
    final token = await ref.read(authRepositoryProvider).readToken();
    if (token == null || token.isEmpty) return null;

    try {
      final user = await ref.read(authServiceProvider).me();
      return AuthSession(
        token: token,
        expiresAt: DateTime.now().add(const Duration(hours: 1)),
        user: user,
      );
    } catch (_) {
      await ref.read(authRepositoryProvider).logout();
      return null;
    }
  }

  Future<void> login({required String email, required String password}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(authRepositoryProvider)
          .login(LoginRequest(email: email, password: password)),
    );
  }

  Future<void> register({
    required String email,
    required String password,
    required String fullName,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      try {
        return await ref.read(authRepositoryProvider).register(
              email: email,
              password: password,
              fullName: fullName,
            );
      } on DioException catch (e) {
        final data = e.response?.data;
        String message = 'Kayıt başarısız';
        if (data is Map) {
          if (data['message'] != null) {
            message = data['message'].toString();
          } else if (data['errors'] != null) {
            final errors = data['errors'];
            if (errors is List) {
              message = errors.join('\n');
            } else if (errors is Map) {
              message = errors.values
                  .expand((v) => v is List ? v : [v])
                  .join('\n');
            }
          }
        }
        throw Exception(message);
      }
    });
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }
}
