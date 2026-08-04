abstract final class AppConstants {
  static const appName = 'Götür Mobile';
  // Android emülatör: http://10.0.2.2:5131/api
  // iOS simülatör / web: http://localhost:5131/api
  static const baseApiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:5131/api',
  );
  static const authTokenKey = 'auth_token';
}
