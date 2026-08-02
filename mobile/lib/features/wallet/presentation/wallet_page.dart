import 'package:flutter/material.dart';

import '../../../core/widgets/feature_placeholder_page.dart';

class WalletPage extends StatelessWidget {
  const WalletPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderPage(
      title: 'Cüzdan',
      description:
          'gotur-web WalletPage yapısına göre bakiye, işlem geçmişi, bakiye yükleme ve kart yönetimi bu feature altında yaşayacak.',
      icon: Icons.account_balance_wallet_rounded,
    );
  }
}
