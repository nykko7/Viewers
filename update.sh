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

echo "Paso 3: Haciendo git pull..."
sudo git pull

echo "Paso 4: Borrando carpeta viewer antigua..."
rm -rf platform/app/viewer

echo "Paso 5: Ejecutando nx reset..."
sudo yarn nx reset

echo "Paso 6: Construyendo con yarn..."
sudo yarn build

echo "Paso 7: Renombrando dist a viewer..."
mv platform/app/dist platform/app/viewer

echo "Paso 8: Iniciando PM2..."
pm2 start --name "viewer" npx -- serve -c ./platform/app/viewer/public/serve.json

echo "¡Proceso de actualización completado!"
