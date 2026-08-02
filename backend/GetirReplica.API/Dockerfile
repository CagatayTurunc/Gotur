FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

# EF Core migration bundle — bağımsız çalışabilen tek binary üretir
RUN dotnet tool install --global dotnet-ef
ENV PATH="$PATH:/root/.dotnet/tools"
RUN dotnet ef migrations bundle \
    --self-contained \
    --target-runtime linux-x64 \
    -o /app/publish/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
# docker-compose healthcheck wget kullanıyor — aspnet:9.0 imajında kurulu değil,
# eksikse container "unhealthy" kalır ve CI'daki health-wait adımı hep timeout'a düşer.
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
USER $APP_UID
ENTRYPOINT ["dotnet", "GetirReplica.API.dll"]
