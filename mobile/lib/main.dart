import 'package:flutter/material.dart';

void main() {
  runApp(const GoturApp());
}

class GoturApp extends StatelessWidget {
  const GoturApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Götür Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF5C36D6)),
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Götür Mobile'), centerTitle: true),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.delivery_dining_rounded,
                  size: 96,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 24),
                Text(
                  'Mobil proje iskeleti hazır',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'Bu klasör artık bağımsız Flutter repo yapısına sahip. '
                  'Buradan devam ederek uygulama ekranlarını ve servislerini '
                  'güvenle geliştirebilirsin.',
                  style: theme.textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  alignment: WrapAlignment.center,
                  children: const [
                    _InfoChip(label: 'Flutter'),
                    _InfoChip(label: 'Android'),
                    _InfoChip(label: 'iOS'),
                    _InfoChip(label: 'Web'),
                    _InfoChip(label: 'Desktop'),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label),
      avatar: const Icon(Icons.check_circle_outline, size: 18),
    );
  }
}
