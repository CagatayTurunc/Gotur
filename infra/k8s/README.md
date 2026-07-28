# Kubernetes Dağıtımı — AWS EC2 + k3s

## Mimari

```
Internet
    │
    ▼ (DNS: Route 53 veya Namecheap → EC2 IP)
AWS EC2 t3.small (Ubuntu 22.04)
    └── k3s (tek node Kubernetes)
        ├── Traefik Ingress (k3s ile dahil gelir)
        ├── gotur-api     (3 replica, HPA ile 20'ye kadar)
        ├── gotur-frontend (2 replica, nginx)
        ├── postgres      (1 replica, PostGIS 16)
        └── redis         (1 replica, şifreli)
```

**Neden k3s?** Tam Kubernetes API'si, aynı `kubectl` komutları, aynı YAML manifestler.
EKS'ten farkı: tek binary, 512MB RAM, tek komutla kurulum. Demo için idealdir.
Production'a geçişte sadece kubeconfig değişir, manifestler aynı kalır.

---

## AWS'de EC2 Açma

1. AWS Console → EC2 → Launch Instance
2. **AMI:** Ubuntu Server 22.04 LTS
3. **Instance type:** t3.small (2 CPU, 2GB RAM) — free tier varsa t3.micro
4. **Key pair:** Yeni oluştur, `.pem` dosyasını indir, güvenli sakla
5. **Security Group — şu portları aç:**

| Port | Protocol | Kaynak | Açıklama |
|------|----------|--------|----------|
| 22 | TCP | Kendi IP'n | SSH erişimi |
| 80 | TCP | 0.0.0.0/0 | HTTP (Traefik) |
| 443 | TCP | 0.0.0.0/0 | HTTPS (Let's Encrypt) |
| 6443 | TCP | Kendi IP'n | kubectl (opsiyonel) |

6. **Storage:** 20 GB gp3 (ücretsiz tier 30 GB'a kadar)
7. Launch → EC2 IP'sini not al

---

## Kurulum (otomatik)

```bash
# EC2'ye bağlan
ssh -i gotur-key.pem ubuntu@EC2_IP

# Ortam değişkenlerini ayarla (GHCR'dan image çekeceksen)
export GITHUB_TOKEN=ghp_xxxxx   # GitHub → Settings → Developer settings → Token
export GITHUB_USER=cagatayturunc

# Kurulum script'ini çalıştır
curl -sfL https://raw.githubusercontent.com/cagatayturunc/gotur-api/main/infra/scripts/setup-ec2.sh | bash
```

Script şunları yapar: k3s kur → secret oluştur → manifest uygula → durum raporu ver.

---

## Manuel kurulum (adım adım)

```bash
# 1. k3s kur
curl -sfL https://get.k3s.io | sh -
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config

# 2. Namespace + Secret oluştur
kubectl apply -f infra/k8s/namespace.yaml
kubectl create secret generic gotur-api-secrets \
  --namespace gotur \
  --from-literal=POSTGRES_USER=gotur \
  --from-literal=POSTGRES_PASSWORD='GUCLU_SIFRE' \
  --from-literal=REDIS_PASSWORD='REDIS_SIFRE' \
  --from-literal=Jwt__Secret='EN_AZ_32_KARAKTER'

# 3. Manifestleri uygula
kubectl apply -k infra/k8s

# 4. Rollout'u izle
kubectl rollout status deployment/gotur-api -n gotur
kubectl rollout status deployment/gotur-frontend -n gotur

# 5. Pod durumuna bak
kubectl get pods -n gotur
```

---

## Domain bağlama

```
Namecheap / Route 53 → A Record:
  @ → EC2_PUBLIC_IP
  www → EC2_PUBLIC_IP
```

Sonra ingress.yaml'daki `gotur.example.com`'u gerçek domain ile güncelle:

```bash
sed -i 's/gotur.example.com/SENIN_DOMAIN.com/g' infra/k8s/ingress.yaml
kubectl apply -f infra/k8s/ingress.yaml
```

---

## HTTPS (Let's Encrypt) — domain bağlandıktan sonra

```bash
# cert-manager kur
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# ClusterIssuer oluştur (e-posta adresini değiştir)
kubectl apply -f infra/k8s/cert-issuer.yaml
```

`infra/k8s/cert-issuer.yaml` dosyası ayrıca oluşturulacak.

---

## Yararlı komutlar

```bash
# Pod durumu
kubectl get pods -n gotur

# API logları
kubectl logs -n gotur -l app.kubernetes.io/name=gotur-api -f

# HPA durumu — otomatik ölçekleme
kubectl get hpa -n gotur

# Ingress IP
kubectl get ingress -n gotur

# Yeni image deploy et (CI bunu otomatik yapar)
kubectl rollout restart deployment/gotur-api -n gotur

# Sorun çıkarsa bir önceki versiyona dön
kubectl rollout undo deployment/gotur-api -n gotur

# Kaynak kullanımı
kubectl top pods -n gotur
```

---

## Dosyalar

| Dosya | İçerik |
|---|---|
| `namespace.yaml` | gotur namespace |
| `configmap.yaml` | Public ayarlar (host, port, JWT issuer) |
| `secret.example.yaml` | Secret format referansı |
| `postgres.yaml` | PostgreSQL + PVC |
| `redis.yaml` | Redis (şifreli) |
| `api.yaml` | API Deployment + Service |
| `frontend.yaml` | Frontend Deployment + Service |
| `ingress.yaml` | Traefik Ingress (routing) |
| `autoscaling.yaml` | HPA + PodDisruptionBudget |
| `kustomization.yaml` | Tüm kaynakları birleştirir |
