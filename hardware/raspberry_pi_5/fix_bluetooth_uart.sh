#!/bin/bash
# Fix: Disable Bluetooth, enable UART on GPIO14/15

echo "Disabling Bluetooth overlay untuk release UART0..."
sudo cp /boot/firmware/config.txt /boot/firmware/config.txt.backup

# Add disable Bluetooth
if ! grep -q "dtoverlay=disable-bt" /boot/firmware/config.txt; then
    echo "dtoverlay=disable-bt" | sudo tee -a /boot/firmware/config.txt
    echo "✅ Added: dtoverlay=disable-bt"
else
    echo "✅ Already present: dtoverlay=disable-bt"
fi

# Ensure UART is enabled
if ! grep -q "enable_uart=1" /boot/firmware/config.txt; then
    echo "enable_uart=1" | sudo tee -a /boot/firmware/config.txt
    echo "✅ Added: enable_uart=1"
else
    echo "✅ Already present: enable_uart=1"
fi

echo ""
echo "Config updated. Rebooting in 5 seconds..."
echo "After reboot, sensor should work!"
echo ""
sudo reboot
