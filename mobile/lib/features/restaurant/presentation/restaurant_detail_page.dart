import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/menu_item_summary.dart';
import '../../../router/app_router.dart';
import '../../checkout/presentation/cart_provider.dart';
import '../domain/restaurant_detail_bundle.dart';

class RestaurantDetailPage extends ConsumerStatefulWidget {
  const RestaurantDetailPage({
    super.key,
    required this.bundle,
  });

  final RestaurantDetailBundle bundle;

  @override
  ConsumerState<RestaurantDetailPage> createState() => _RestaurantDetailPageState();
}

class _RestaurantDetailPageState extends ConsumerState<RestaurantDetailPage> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final restaurant = widget.bundle.restaurant;
    final allProducts = widget.bundle.products;
    final products = _query.trim().isEmpty
        ? allProducts
        : allProducts.where((item) {
            final haystack = [
              item.name,
              item.description,
              item.category,
            ].join(' ').toLowerCase();
            return haystack.contains(_query.trim().toLowerCase());
          }).toList();

    final cart = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(title: Text(restaurant.name)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: SizedBox(
              height: 220,
              child: restaurant.logoUrl == null || restaurant.logoUrl!.isEmpty
                  ? Container(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      child: const Icon(Icons.restaurant_rounded, size: 64),
                    )
                  : CachedNetworkImage(
                      imageUrl: restaurant.logoUrl!,
                      fit: BoxFit.cover,
                    ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            restaurant.name,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            restaurant.description.isEmpty
                ? restaurant.address
                : restaurant.description,
          ),
          const SizedBox(height: 8),
          Text(
            restaurant.address,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            onChanged: (value) => setState(() => _query = value),
            decoration: InputDecoration(
              hintText: 'Menü içinde ara',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _query = '');
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Ürünler',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text('${products.length} ürün'),
            ],
          ),
          const SizedBox(height: 12),
          if (products.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text('Bu restoran için gösterilecek ürün bulunamadı.'),
              ),
            )
          else
            ...products.map((product) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _RestaurantMenuItemCard(
                product: product,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
              ),
            )),
        ],
      ),
      bottomNavigationBar: cart.items.isEmpty ? null : SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: FilledButton(
          onPressed: () => context.push(AppRouter.checkout),
          child: Text('Sepete geç (${cart.totalAmount} TL)'),
        ),
      ),
    );
  }
}

class _RestaurantMenuItemCard extends ConsumerWidget {
  const _RestaurantMenuItemCard({
    required this.product,
    required this.restaurantId,
    required this.restaurantName,
  });

  final MenuItemSummary product;
  final String restaurantId;
  final String restaurantName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: InkWell(
        onTap: () {
          ref.read(cartProvider.notifier).addItem(
            product,
            restaurantId,
            restaurantName,
          );
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${product.name} sepete eklendi.'),
              duration: const Duration(seconds: 1),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: SizedBox(
                  width: 88,
                  height: 88,
                  child: product.imageUrl == null || product.imageUrl!.isEmpty
                      ? Container(
                          color: Theme.of(context).colorScheme.primaryContainer,
                          child: const Icon(Icons.fastfood_rounded),
                        )
                      : CachedNetworkImage(
                          imageUrl: product.imageUrl!,
                          fit: BoxFit.cover,
                        ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      product.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Chip(label: Text(product.category)),
                        const Spacer(),
                        Text(
                          '₺${product.price.toStringAsFixed(0)}',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(Icons.add_circle, color: Colors.deepPurple),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

