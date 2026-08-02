import 'package:flutter/material.dart';

abstract final class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF5C36D6)),
    scaffoldBackgroundColor: const Color(0xFFF7F7FB),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
  );

  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFFFF5D66),
      brightness: Brightness.dark,
    ),
    scaffoldBackgroundColor: const Color(0xFF170C0C),
    cardTheme: CardThemeData(
      elevation: 0,
      color: const Color(0xFF251414),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF341E1E),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
    ),
  );
}
