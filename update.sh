#!/bin/bash

# -e: Detener el script si un comando devuelve un error
# -o pipefail: Si un comando en un pipe falla, se considera error
# -u: Falla si se usa una variable no declarada
set -euo pipefail

# Con trap podemos capturar el error y mostrar más información.
trap 'echo "Error en la línea $LINENO: Comando: $BASH_COMMAND. Código de salida: $?"' ERR

echo "Paso 1: Eliminando PM2 viewer..."
pm2 delete viewer || true

echo "Paso 2: Cambiando directorio..."
cd /var/services/Viewers/

echo "Paso 3: Guardando hash del package.json actual..."
OLD_PACKAGE_HASH=$(git hash-object package.json 2>/dev/null || echo "no-package")

echo "Paso 4: Haciendo git pull..."
sudo git pull

echo "Paso 5: Verificando cambios en package.json..."
NEW_PACKAGE_HASH=$(git hash-object package.json)

if [ "$OLD_PACKAGE_HASH" != "$NEW_PACKAGE_HASH" ]; then
    echo "Se detectaron cambios en package.json, ejecutando yarn install..."
    sudo yarn install
fi

echo "Paso 6: Borrando carpeta viewer antigua..."
sudo rm -rf platform/app/viewer

echo "Paso 7: Ejecutando nx reset..."
sudo yarn nx reset

echo "Paso 8: Construyendo con yarn..."
sudo yarn build

echo "Paso 9: Renombrando dist a viewer..."
mv platform/app/dist platform/app/viewer

echo "Paso 10: Iniciando PM2..."
cd ./platform/app
pm2 start --name "viewer" npx -- serve -c ./public/serve.json

echo "¡Proceso de actualización completado!"
