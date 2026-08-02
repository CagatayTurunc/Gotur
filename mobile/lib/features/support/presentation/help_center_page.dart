import 'package:flutter/material.dart';

import '../../../core/widgets/feature_placeholder_page.dart';

class HelpCenterPage extends StatelessWidget {
  const HelpCenterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderPage(
      title: 'Yardım Merkezi',
      description:
          'gotur-web içindeki HelpDrawer veri yapısı mobilde kategori bazlı yardım merkezi ekranına dönüştürülecek.',
      icon: Icons.help_center_rounded,
    );
  }
}
