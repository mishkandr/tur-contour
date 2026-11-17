# ТурКонтур на Ubuntu 24.04

На VPS нужен пользователь с доступом по SSH и `sudo`. Для доступа по публичной ссылке понадобится имя, которое указывает на адрес VPS. До настройки имени приложение можно проверять через SSH-туннель.

## Подготовить сервер и передать выпуск

Установите Node.js 22 или новее из официального выпуска для архитектуры VPS. Проверьте подпись контрольных сумм и SHA-256 архива. Исполняемый файл должен быть доступен как `/usr/local/bin/node`. У приложения нет зависимостей npm. [Загрузки Node.js и проверка подписи](https://nodejs.org/en/download)

На своей машине выполните из репозитория. Подставьте пользователя и адрес VPS вместо `ADMIN@VPS`.

```sh
git fetch origin dev
release_id=$(git rev-parse origin/dev)
archive="/tmp/tur-contour-$release_id.tar.gz"
git archive --format=tar.gz --output="$archive" "$release_id"
scp "$archive" ADMIN@VPS:~
printf '%s\n' "$release_id"
```

На VPS подставьте напечатанный идентификатор вместо `COMMIT_SHA`. Для обновлений повторите передачу и этот блок. История Git и учётные данные остаются на машине, где собран архив.

```sh
release_id=COMMIT_SHA
release="/opt/tur-contour/releases/$release_id"
if ! id turcontour >/dev/null 2>&1; then
    sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin turcontour
fi
sudo install -d -m 0755 /opt/tur-contour/releases
sudo mkdir -m 0755 "$release" &&
sudo tar -xzf "$HOME/tur-contour-$release_id.tar.gz" --no-same-owner -C "$release" &&
(cd "$release" && /usr/local/bin/node --test)
```

Если тесты прошли, переключите выпуск и установите службу. `systemd` создаст каталог `/var/lib/tur-contour` для состояния. Он используется и после смены версии кода.

```sh
sudo ln -sfn "$release" /opt/tur-contour/current.next
sudo mv -Tf /opt/tur-contour/current.next /opt/tur-contour/current
sudo install -m 0644 "$release/deploy/tur-contour.service" /etc/systemd/system/tur-contour.service
sudo systemctl daemon-reload
sudo systemctl enable tur-contour
sudo systemctl restart tur-contour
curl -fsS --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:4173/api/state >/dev/null
```

При ошибке проверьте `sudo journalctl -u tur-contour -n 50 --no-pager`. Для отката переключите ссылку `current` на предыдущий выпуск и перезапустите `tur-contour`.

## Доступ к приложению

Пока адрес без доменного имени, оставьте `4173` на loopback и откройте туннель со своей машины. Затем используйте в браузере `http://127.0.0.1:4173`.

```sh
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:4173:127.0.0.1:4173 ADMIN@VPS
```

Для публичной ссылки направьте DNS на VPS, установите Caddy 2.8 или новее и обеспечьте доступ к `80/tcp` и `443/tcp`. Приложение продолжит слушать `127.0.0.1:4173`. Выполните `caddy hash-password` на сервере и сохраните выведенный хеш в Caddyfile. Подставьте своё имя вместо `tour.example.org` и хеш вместо `PASSWORD_HASH`.

```caddyfile
tour.example.org {
    basic_auth {
        reviewer PASSWORD_HASH
    }

    @foreignWrite {
        method POST
        not header Origin https://tour.example.org
    }
    respond @foreignWrite 403

    reverse_proxy 127.0.0.1:4173 {
        header_up -Authorization
    }
}
```

```sh
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
curl -sS -o /dev/null -w '%{http_code}\n' https://tour.example.org/api/state
curl -sS -u reviewer -o /dev/null -w '%{http_code}\n' https://tour.example.org/api/state
```

Ожидаются `401` без пароля и `200` с паролем. Проверка `Origin` защищает команды интерфейса от отправки с другого сайта. [Установка Caddy](https://caddyserver.com/docs/install), [HTTPS](https://caddyserver.com/docs/automatic-https), [Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth)

## Локальная модель

Ollama дополнительно запускается на `127.0.0.1:11434`. Если она установлена, загрузите `qwen3.5:4b` через `ollama pull qwen3.5:4b` и проверьте отклик на VPS. При необходимости параметры приложения задаются в `/etc/tur-contour/app.env`, который должен быть доступен только `root`. `TUR_OLLAMA_MODEL` выбирает установленную модель. `TUR_NO_LLM=1` включает разбор запроса без модели. После изменения переменных перезапустите `tur-contour`. [Настройка Ollama под Linux](https://docs.ollama.com/faq)
