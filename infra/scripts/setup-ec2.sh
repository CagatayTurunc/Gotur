#!/bin/bash
# EC2 Ubuntu 22.04 üzerine k3s + Gotur kurulum script'i
# Kullanım: EC2'ye SSH ile bağlandıktan sonra bu script'i çalıştır
#   curl -sfL https://raw.githubusercontent.com/cagatayturunc/gotur-api/main/infra/scripts/setup-ec2.sh | bash
# Ya da dosyayı kopyalayıp: chmod +x setup-ec2.sh && ./setup-ec2.sh

set -e  # Hata olursa dur
echo "=== Gotur EC2 Kurulum Başlıyor ==="

# ── 1. Sistem güncellemesi ────────────────────────────────────────────────────
echo "[1/6] Sistem güncelleniyor..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl wget git

# ── 2. k3s kurulumu ──────────────────────────────────────────────────────────
# k3s: production-grade hafif Kubernetes.
# Tek komutla kuruluyor, Traefik ingress dahil geliyor.
echo "[2/6] k3s kuruluyor..."
curl -sfL https://get.k3s.io | sh -

# kubectl erişimi için KUBECONFIG ayarla
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config
echo "export KUBECONFIG=~/.kube/config" >> ~/.bashrc

# k3s'in hazır olmasını bekle
echo "k3s hazır olana kadar bekleniyor..."
sleep 15
kubectl wait --for=condition=ready node --all --timeout=120s

echo "k3s hazır. Node durumu:"
kubectl get nodes

# ── 3. GHCR image pull secret ────────────────────────────────────────────────
# GitHub Container Registry'den private image çekmek için token gerekli.
# GITHUB_TOKEN environment variable'ı set edilmiş olmalı.
echo "[3/6] GHCR secret oluşturuluyor..."

if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_USER" ]; then
  echo "UYARI: GITHUB_TOKEN ve GITHUB_USER set edilmemiş."
  echo "Image'lar public ise bu adımı atlayabilirsin."
  echo "Yoksa: export GITHUB_TOKEN=... GITHUB_USER=... yapıp script'i tekrar çalıştır."
else
  kubectl create namespace gotur --dry-run=client -o yaml | kubectl apply -f -
  kubectl create secret docker-registry ghcr-secret \
    --namespace gotur \
    --docker-server=ghcr.io \
    --docker-username="$GITHUB_USER" \
    --docker-password="$GITHUB_TOKEN" \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "GHCR secret oluşturuldu."
fi

# ── 4. Gotur Secret oluştur ───────────────────────────────────────────────────
echo "[4/6] Uygulama secret'ları oluşturuluyor..."
echo ""
echo "Aşağıdaki değerleri gir (boş bırakırsan varsayılan kullanılır):"

read -p "PostgreSQL şifresi [GoturPg2024!]: " PG_PASS
PG_PASS=${PG_PASS:-GoturPg2024!}

read -p "Redis şifresi [GoturRedis2024!]: " REDIS_PASS
REDIS_PASS=${REDIS_PASS:-GoturRedis2024!}

read -p "JWT Secret (min 32 karakter) [otomatik üretilsin]: " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  echo "JWT Secret otomatik üretildi."
fi

kubectl create namespace gotur --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic gotur-api-secrets \
  --namespace gotur \
  --from-literal=POSTGRES_USER=gotur \
  --from-literal=POSTGRES_PASSWORD="$PG_PASS" \
  --from-literal=REDIS_PASSWORD="$REDIS_PASS" \
  --from-literal=Jwt__Secret="$JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secret oluşturuldu."

# ── 5. Manifestleri uygula ────────────────────────────────────────────────────
echo "[5/6] Kubernetes manifestleri uygulanıyor..."

# Repo'yu çek (veya zaten varsa güncelle)
if [ -d ~/gotur-app ]; then
  cd ~/gotur-app && git pull
else
  git clone https://github.com/cagatayturunc/gotur-api.git ~/gotur-app
  cd ~/gotur-app
fi

kubectl apply -k infra/k8s

echo "Deployment bekleniyor..."
kubectl rollout status deployment/postgres -n gotur --timeout=120s
kubectl rollout status deployment/redis -n gotur --timeout=120s
kubectl rollout status deployment/gotur-api -n gotur --timeout=180s
kubectl rollout status deployment/gotur-frontend -n gotur --timeout=120s

# ── 6. Durum raporu ───────────────────────────────────────────────────────────
echo ""
echo "[6/6] Kurulum tamamlandı!"
echo ""
echo "=== Pod Durumu ==="
kubectl get pods -n gotur

echo ""
echo "=== Servisler ==="
kubectl get services -n gotur

echo ""
echo "=== Ingress ==="
kubectl get ingress -n gotur

EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "IP alınamadı")
echo ""
echo "EC2 Public IP: $EC2_IP"
echo ""
echo "Sonraki adım: DNS'te A record oluştur"
echo "  gotur.xyz → $EC2_IP"
echo ""
echo "Test için: curl http://$EC2_IP/health/ready"
