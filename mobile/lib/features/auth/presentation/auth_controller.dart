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
    if (token == null || token.isEmpty) {
      return null;
    }

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

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }
}
