import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/app_user.dart';
import '../../../core/models/auth_session.dart';
import '../../../network/api_client.dart';
import '../domain/login_request.dart';

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(dioProvider)),
);

class AuthService {
  AuthService(this._dio);

  final Dio _dio;

  Future<AuthSession> login(LoginRequest request) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: request.toJson(),
    );
    return AuthSession.fromJson(response.data ?? <String, dynamic>{});
  }

  Future<AuthSession> register({
    required String email,
    required String password,
    required String fullName,
    String role = 'customer',
  }) async {
    final body = {
      'email': email,
      'password': password,
      'fullName': fullName,
      'role': role,
    };

    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/register',
      data: body,
      options: Options(
        headers: {'Content-Type': 'application/json'},
      ),
    );
    return AuthSession.fromJson(response.data ?? <String, dynamic>{});
  }

  Future<AppUser> me() async {
    final response = await _dio.get<Map<String, dynamic>>('/auth/me');
    return AppUser.fromJson(response.data ?? <String, dynamic>{});
  }
}
