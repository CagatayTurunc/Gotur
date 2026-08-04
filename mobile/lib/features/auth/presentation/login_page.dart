import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../router/app_router.dart';
import 'auth_controller.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  // Login form
  final _loginFormKey = GlobalKey<FormState>();
  final _loginEmailCtrl = TextEditingController();
  final _loginPasswordCtrl = TextEditingController();

  // Register form
  final _registerFormKey = GlobalKey<FormState>();
  final _registerNameCtrl = TextEditingController();
  final _registerEmailCtrl = TextEditingController();
  final _registerPasswordCtrl = TextEditingController();
  final _registerPasswordConfirmCtrl = TextEditingController();

  bool _loginObscure = true;
  bool _registerObscure = true;
  bool _registerObscureConfirm = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginEmailCtrl.dispose();
    _loginPasswordCtrl.dispose();
    _registerNameCtrl.dispose();
    _registerEmailCtrl.dispose();
    _registerPasswordCtrl.dispose();
    _registerPasswordConfirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_loginFormKey.currentState!.validate()) return;

    await ref.read(authControllerProvider.notifier).login(
          email: _loginEmailCtrl.text.trim(),
          password: _loginPasswordCtrl.text,
        );

    final authState = ref.read(authControllerProvider);
    if (authState.hasError && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(authState.error.toString())),
      );
      return;
    }

    final session = authState.valueOrNull;
    if (mounted && session != null) {
      _navigateByRole(session.user.role);
    }
  }

  Future<void> _register() async {
    if (!_registerFormKey.currentState!.validate()) return;

    await ref.read(authControllerProvider.notifier).register(
          email: _registerEmailCtrl.text.trim(),
          password: _registerPasswordCtrl.text,
          fullName: _registerNameCtrl.text.trim(),
        );

    final authState = ref.read(authControllerProvider);
    if (authState.hasError && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(authState.error.toString())),
      );
      return;
    }

    final session = authState.valueOrNull;
    if (mounted && session != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kayıt başarılı, hoş geldin!')),
      );
      _navigateByRole(session.user.role);
    }
  }

  void _navigateByRole(String role) {
    final r = role.toLowerCase();
    final dest = r == 'courier'
        ? AppRouter.courierPanel
        : r == 'restaurant'
            ? AppRouter.restaurantPanel
            : AppRouter.customerHome;
    context.go(dest);
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authControllerProvider).isLoading;
    final theme = Theme.of(context);

    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(
                  Icons.delivery_dining_rounded,
                  size: 80,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  AppConstants.appName,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 28),

                // Tab bar
                Container(
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    indicator: BoxDecoration(
                      color: theme.colorScheme.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    labelColor: theme.colorScheme.onPrimary,
                    unselectedLabelColor: theme.colorScheme.onSurface,
                    dividerColor: Colors.transparent,
                    tabs: const [
                      Tab(text: 'Giriş Yap'),
                      Tab(text: 'Kayıt Ol'),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  height: 380,
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      // ── Login Tab ──
                      Form(
                        key: _loginFormKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextFormField(
                              controller: _loginEmailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(
                                labelText: 'E-posta',
                                prefixIcon: Icon(Icons.email_outlined),
                              ),
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'E-posta zorunlu';
                                }
                                if (!v.contains('@')) return 'Geçerli e-posta gir';
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _loginPasswordCtrl,
                              obscureText: _loginObscure,
                              decoration: InputDecoration(
                                labelText: 'Şifre',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                  icon: Icon(_loginObscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined),
                                  onPressed: () => setState(
                                      () => _loginObscure = !_loginObscure),
                                ),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) return 'Şifre zorunlu';
                                if (v.length < 6) return 'En az 6 karakter';
                                return null;
                              },
                            ),
                            const SizedBox(height: 24),
                            FilledButton(
                              onPressed: isLoading ? null : _login,
                              child: isLoading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Text('Giriş Yap'),
                            ),
                          ],
                        ),
                      ),

                      // ── Register Tab ──
                      Form(
                        key: _registerFormKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextFormField(
                              controller: _registerNameCtrl,
                              textCapitalization: TextCapitalization.words,
                              decoration: const InputDecoration(
                                labelText: 'Ad Soyad',
                                prefixIcon: Icon(Icons.person_outline),
                              ),
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'Ad soyad zorunlu';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _registerEmailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(
                                labelText: 'E-posta',
                                prefixIcon: Icon(Icons.email_outlined),
                              ),
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'E-posta zorunlu';
                                }
                                if (!v.contains('@')) return 'Geçerli e-posta gir';
                                return null;
                              },
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _registerPasswordCtrl,
                              obscureText: _registerObscure,
                              decoration: InputDecoration(
                                labelText: 'Şifre',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                  icon: Icon(_registerObscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined),
                                  onPressed: () => setState(() =>
                                      _registerObscure = !_registerObscure),
                                ),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) return 'Şifre zorunlu';
                                if (v.length < 6) return 'En az 6 karakter';
                                return null;
                              },
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _registerPasswordConfirmCtrl,
                              obscureText: _registerObscureConfirm,
                              decoration: InputDecoration(
                                labelText: 'Şifre Tekrar',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                  icon: Icon(_registerObscureConfirm
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined),
                                  onPressed: () => setState(() =>
                                      _registerObscureConfirm =
                                          !_registerObscureConfirm),
                                ),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) {
                                  return 'Şifre tekrarı zorunlu';
                                }
                                if (v != _registerPasswordCtrl.text) {
                                  return 'Şifreler eşleşmiyor';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 20),
                            FilledButton(
                              onPressed: isLoading ? null : _register,
                              child: isLoading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Text('Kayıt Ol'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => context.go(AppRouter.customerHome),
                  child: const Text('Misafir olarak devam et'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
