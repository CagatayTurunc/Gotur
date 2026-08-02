import '../../../core/widgets/feature_placeholder_page.dart';
import 'package:flutter/material.dart';

class AddressPickerPage extends StatelessWidget {
  const AddressPickerPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderPage(
      title: 'Adres Seçimi',
      description:
          'gotur-web içindeki AddressPickerModal akışının mobil karşılığı burada kurulacak. Kaydedilmiş adresler, konum seçimi ve Nominatim araması bu feature altında yaşayacak.',
      icon: Icons.location_on_rounded,
    );
  }
}
