import 'package:flutter_test/flutter_test.dart';

import 'package:gotur_mobile/main.dart';

void main() {
  testWidgets('app shows mobile skeleton title', (WidgetTester tester) async {
    await tester.pumpWidget(const GoturApp());

    expect(find.text('Götür Mobile'), findsOneWidget);
    expect(find.text('Mobil proje iskeleti hazır'), findsOneWidget);
  });
}
