window.addEventListener("load", function () {
    if (typeof MercadoPago !== "undefined") {
        const mp = new MercadoPago('APP_USR-84817fc5-5c0c-4ecb-b68e-b9174b2aa96d', {
            locale: 'es-AR'
        });

        const checkoutButton = document.getElementById("checkout-btn");
        checkoutButton.addEventListener("click", function () {
            const priceInput = document.getElementById("price-input");
            const price = parseFloat(priceInput.value);

            if (isNaN(price) || price <= 0) {
                alert("Por favor, ingrese un monto válido.");
                return;
            }

            // Datos fijos
            const description = "Crédito en la máquina expendedora";
            const quantity = 1;

            const orderData = {
                description,
                price,
                quantity,
                orderId: "CREDITO" // Identificador fijo para este tipo de transacción
            };

            console.log("Datos enviados al servidor:", orderData);

            fetch("https://electronica2-maquina-expendedora.onrender.com/create_preference", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(orderData),
            })
            .then(response => response.json())
            .then(preference => {
                if (!preference.id) {
                    alert("No se pudo generar la preferencia de pago.");
                    return;
                }
                createCheckoutButton(preference.id);
            })
            .catch(error => {
                console.error("Error al comunicarse con el servidor:", error);
                alert("Error al generar el pago.");
            });
        });

        function createCheckoutButton(preferenceId) {
            const bricksBuilder = mp.bricks();

            const renderComponent = async () => {
                try {
                    if (window.checkoutButton) {
                        window.checkoutButton.unmount();
                        window.checkoutButton = null;
                    }

                    window.checkoutButton = await bricksBuilder.create("wallet", "button-checkout", {
                        initialization: { preferenceId },
                        callbacks: {
                            onError: (error) => console.error("Error en el pago:", error),
                            onReady: () => console.log("Botón de pago listo"),
                        },
                    });
                } catch (error) {
                    console.error("Error al renderizar el botón de pago:", error);
                }
            };

            renderComponent();
        }
    } else {
        console.error("MercadoPago SDK no cargado");
    }
});
