# Deploy Rehberi — gotur.site

## Değişiklik yaptıktan sonra ne yapmalısın?

### 1. Kodu push et
```bash
git add .
git commit -m "açıklama"
git push origin main
```

### 2. CI'ın bitmesini bekle
GitHub → Actions → en son run → **Docker Build & Push** adımı yeşil olsun.
(~3-5 dakika sürer)

### 3. Sunucuya bağlan
```powershell
ssh -i "C:\Users\Cagatay\Downloads\gotur-key.pem" ubuntu@16.170.85.248
```

### 4. Sunucuda güncelle
```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
cd ~/gotur && git pull
```

**Backend değiştirdiysen** (DataSeeder, Controller, Service vb.):
```bash
kubectl rollout restart deployment/gotur-api -n gotur
kubectl rollout status deployment/gotur-api -n gotur
```

**Frontend değiştirdiysen** (React, CSS, görseller vb.):
```bash
kubectl rollout restart deployment/gotur-frontend -n gotur
kubectl rollout status deployment/gotur-frontend -n gotur
```

**İkisi de değiştiyse:**
```bash
kubectl rollout restart deployment/gotur-api deployment/gotur-frontend -n gotur
```

---

## Sunucu bilgileri

| Bilgi | Değer |
|-------|-------|
| IP | 16.170.85.248 |
| SSH key | C:\Users\Cagatay\Downloads\gotur-key.pem |
| Site | https://gotur.site |
| Platform | AWS EC2 t3.small + k3s Kubernetes |

---

## Sunucu kilitlenirse

AWS Console → EC2 → gotur-production → **Instance state → Stop → Start**

Açılınca:
```bash
ssh -i "C:\Users\Cagatay\Downloads\gotur-key.pem" ubuntu@16.170.85.248
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get pods -n gotur
```

---

## Yararlı komutlar

```bash
# Pod durumu
kubectl get pods -n gotur

# API logları (canlı)
kubectl logs -n gotur -l app.kubernetes.io/name=gotur-api -f

# Bellek kullanımı
free -h

# HTTPS sertifikası durumu
kubectl get certificate -n gotur
```

---

## Neden sunucuda build yapmıyoruz?

t3.small sadece 2GB RAM'e sahip. .NET veya React build işlemi
tüm RAM'i doldurup sunucuyu kitliyor.

CI pipeline (GitHub Actions) image'ları kendi ortamında build edip
GHCR'a push ediyor. Sunucu sadece hazır image'ı çekiyor — build yok, RAM sorunu yok.
