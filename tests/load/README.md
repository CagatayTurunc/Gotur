# Login yük testi

Bu klasör, giriş akışının k6 ile tekrarlanabilir performans testini içerir.
`smoke`, `load` ve toplam 1.000.000 iterasyon üreten `million` profilleri vardır.

## Hızlı kontrol

```bash
docker compose up -d postgres redis api
docker run --rm --network host \
  -v "$PWD/tests/load:/scripts" \
  -w /scripts \
  grafana/k6:0.57.0 run -e PROFILE=smoke login.js
```

Windows Docker Desktop'ta `host.docker.internal` kullanın:

```powershell
docker run --rm `
  -e BASE_URL=http://host.docker.internal:5131 `
  -e PROFILE=smoke `
  -v "${PWD}/tests/load:/scripts" `
  -w /scripts grafana/k6:0.57.0 run login.js
```

## Kontrollü yük

```bash
cd tests/load
k6 run -e PROFILE=load -e RATE=250 -e DURATION=10m login.js
```

## 1 milyon giriş

```bash
cd tests/load
k6 run \
  -e PROFILE=million \
  -e VUS=1000 \
  -e TOTAL_ITERATIONS=1000000 \
  -e MAX_DURATION=2h \
  login.js
```

Bir milyon toplam istek, bir milyon eşzamanlı bağlantı anlamına gelmez. Gerçek
kapasite testi; izole bir test ortamında, birden fazla k6 yük üreticisiyle ve
PostgreSQL/Redis/API metrikleri birlikte izlenerek yapılmalıdır. Aynı test hesabı
kimlik doğrulama maliyetini ölçer; veri kardinalitesini ölçmek için önceden
hazırlanmış benzersiz hesap havuzu kullanılmalıdır.

Varsayılan SLO eşikleri:

- Hata oranı `< %1`
- p95 `< 500 ms`
- p99 `< 1 sn`

Sonuç özeti `tests/load/results/login-summary.json` dosyasına yazılır.
