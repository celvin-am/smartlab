#!/bin/bash
# Cleanup debug scripts dari Raspberry Pi

echo "🧹 Cleaning up debug scripts..."
echo ""

# List of debug files to remove
DEBUG_FILES=(
    "test_fingerprint.py"
    "test_serial_debug.py"
    "test_gpio_voltage.py"
    "test_uart_routing.py"
    "test_as608_direct.py"
    "test_loopback.py"
    "fix_bluetooth_uart.sh"
    "fix_config_format.sh"
    "debug_hex.py"
)

for file in "${DEBUG_FILES[@]}"; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "  ✅ Deleted: $file"
    fi
done

echo ""
echo "✅ Cleanup selesai!"
echo ""
echo "📂 Files yang tersisa:"
ls -lh *.py *.sh 2>/dev/null | grep -v "^total" || echo "  (directory listing)"
