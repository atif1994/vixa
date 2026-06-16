import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vixa_mobile/screens/home_screen.dart';

void main() {
  testWidgets('Home screen shows ViXa title', (tester) async {
    await tester.pumpWidget(MaterialApp(home: const HomeScreen()));
    expect(find.text('ViXa CIAM'), findsOneWidget);
    expect(find.text('Full Onboarding'), findsOneWidget);
  });
}
