import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../router/app_router.dart';
import '../../auth/presentation/auth_controller.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('Hesabım')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const CircleAvatar(radius: 36, child: Icon(Icons.person, size: 36)),
          const SizedBox(height: 16),
          Text(
            session?.user.fullName ?? 'Misafir kullanıcı',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            session?.user.email ?? 'Backend oturumu yok',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Card(
            child: ListTile(
              leading: const Icon(Icons.verified_user_outlined),
              title: const Text('Rol'),
              subtitle: Text(session?.user.role ?? 'guest'),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.shopping_bag_outlined),
                  title: const Text('Siparişlerim'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRouter.orders),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.account_balance_wallet_rounded),
                  title: const Text('Cüzdan'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRouter.wallet),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.location_on_outlined),
                  title: const Text('Adreslerim'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRouter.addressPicker),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.help_center_outlined),
                  title: const Text('Yardım Merkezi'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(AppRouter.helpCenter),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
