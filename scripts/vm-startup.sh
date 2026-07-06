#!/bin/bash
# VM provisioning / startup script for a fresh Debian host that runs this stack.
#
# Usage when creating a VM:
#   gcloud compute instances create sahyog-server \
#     --machine-type e2-medium --image-family debian-12 --image-project debian-cloud \
#     --boot-disk-size 30GB --tags http-server,https-server \
#     --address <RESERVED_STATIC_IP> \
#     --scopes https://www.googleapis.com/auth/cloud-platform \
#     --metadata-from-file startup-script=scripts/vm-startup.sh
#
# Installs everything the deploy + app need:
#   - Docker + compose plugin (runs the stack)
#   - rsync   (the CI deploy syncs code/dist to the VM over rsync)
#   - git     (kept for convenience)
#   - certbot (Let's Encrypt HTTPS)
#
# Notes learned the hard way:
#   - Give the VM the cloud-platform scope (--scopes above) so its service
#     account can call Vertex AI for auto-research; otherwise Vertex 403s.
#   - Use a RESERVED static IP (--address) so stop/start doesn't change the IP
#     and break DNS.
set -e

apt-get update
apt-get install -y ca-certificates curl git rsync certbot

# Docker (official repo)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

touch /var/log/vm-provision-ready
