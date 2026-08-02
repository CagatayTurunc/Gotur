import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:gotur_mobile/app.dart';
import 'package:gotur_mobile/features/customer/data/restaurant_service.dart';

void main() {
  testWidgets('app shows mobile skeleton title', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerCatalogProvider.overrideWith(
            (ref) async =>
                const CustomerCatalog(restaurants: [], products: []),
          ),
        ],
        child: const GoturApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Götür'), findsOneWidget);
    expect(find.text('Restoranlar'), findsOneWidget);
    expect(find.text('Giriş'), findsOneWidget);
  });
}
