window.addEventListener("load", function () {
    if (typeof MercadoPago !== "undefined") {
        const mp = new MercadoPago('APP_USR-84817fc5-5c0c-4ecb-b68e-b9174b2aa96d', {
            locale: 'es-AR'
        });

        document.querySelectorAll(".checkout-btn").forEach(button => {
            button.addEventListener("click", function () {
                // Deshabilita el botón actual
                button.disabled = true;

                // Habilita todos los demás botones
                document.querySelectorAll(".checkout-btn").forEach(otherButton => {
                    if (otherButton !== button) {
                        otherButton.disabled = false;
                    }
                });

                const suffix = button.dataset.product;

                const description = document.getElementById(`product-description-${suffix}`).textContent;
                const price = parseFloat(document.getElementById(`unit-price-${suffix}`).textContent);
                const quantity = parseInt(document.getElementById(`quantity-${suffix}`).textContent);

                const orderData = {
                    description,
                    price,
                    quantity,
                    orderId: suffix.toUpperCase() // ← NUEVO: A, B o C
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
                        button.disabled = false; // Habilita el botón si ocurre un error
                        return;
                    }
                    const targetId = `button-checkout-${suffix}`;
                    createCheckoutButton(preference.id, targetId);
                })
                .catch(error => {
                    console.error("Error al comunicarse con el servidor:", error);
                    alert("Error al generar el pago.");
                    button.disabled = false; // Habilita el botón si ocurre un error
                });
            });
        });

        function createCheckoutButton(preferenceId, elementId) {
            const bricksBuilder = mp.bricks();

            const renderComponent = async () => {
                try {
                    if (window.checkoutButton) {
                        window.checkoutButton.unmount();
                        window.checkoutButton = null;
                    }

                    window.checkoutButton = await bricksBuilder.create("wallet", elementId, {
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
