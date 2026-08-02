import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../network/api_client.dart';

class TrackingPage extends ConsumerStatefulWidget {
  const TrackingPage({super.key, this.orderId});

  final String? orderId;

  @override
  ConsumerState<TrackingPage> createState() => _TrackingPageState();
}

class _TrackingPageState extends ConsumerState<TrackingPage> {
  bool _isLoading = true;
  Map<String, dynamic>? _orderData;

  @override
  void initState() {
    super.initState();
    _fetchOrder();
  }

  Future<void> _fetchOrder() async {
    if (widget.orderId == null) return;
    try {
      final response = await ref.read(dioProvider).get('/api/orders/${widget.orderId}');
      if (mounted) {
        setState(() {
          _orderData = response.data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Canlı Takip'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(), // Kullanıcının geri çıkabilmesi
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _orderData == null
              ? const Center(child: Text('Sipariş detayı bulunamadı.'))
              : Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(Icons.location_on, size: 64, color: Colors.deepPurple),
                      const SizedBox(height: 24),
                      Text(
                        'Durum: ${_orderData!['status']}',
                        style: Theme.of(context).textTheme.headlineSmall,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Restoran: ${_orderData!['restaurantName']}',
                        style: Theme.of(context).textTheme.titleMedium,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 32),
                      const Text(
                        'Harita entegrasyonu ve SignalR ile canlı kurye konumu bu ekranda görüntülenecektir.',
                        textAlign: TextAlign.center,
                      ),
                      const Spacer(),
                      ElevatedButton(
                        onPressed: () => _fetchOrder(),
                        child: const Text('Durumu Yenile'),
                      ),
                    ],
                  ),
                ),
    );
  }
}

