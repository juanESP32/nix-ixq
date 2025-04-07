window.addEventListener("load", function () {
    if (typeof MercadoPago !== "undefined") {
        const mp = new MercadoPago('APP_USR-84817fc5-5c0c-4ecb-b68e-b9174b2aa96d', {
            locale: 'es-AR'
        });

        const checkoutButtons = document.querySelectorAll(".checkout-btn");

        checkoutButtons.forEach((button) => {
            button.addEventListener("click", function () {
                button.disabled = true;

                const description = button.getAttribute("data-description");
                const price = parseFloat(button.getAttribute("data-price"));
                const quantity = parseInt(button.getAttribute("data-quantity"));

                const orderData = { description, price, quantity };

                fetch("https://electronica2-maquina-expendedora.onrender.com/create_preference", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(orderData),
                })
                .then((response) => response.json())
                .then((preference) => {
                    if (!preference.id) {
                        alert("No se pudo generar la preferencia de pago.");
                        button.disabled = false;
                        return;
                    }
                    createCheckoutButton(preference.id, button);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    alert("Error al comunicarse con el servidor.");
                    button.disabled = false;
                });
            });
        });

        function createCheckoutButton(preferenceId, button) {
            const container = button.nextElementSibling;

            if (!container || !container.classList.contains("button-checkout-container")) {
                console.error("No se encontró el contenedor para el botón de pago.");
                button.disabled = false;
                return;
            }

            const bricksBuilder = mp.bricks();

            bricksBuilder.create("wallet", container, {
                initialization: { preferenceId },
                callbacks: {
                    onError: (error) => {
                        console.error("Error en el pago:", error);
                        button.disabled = false;
                    },
                    onReady: () => {
                        console.log("El botón de pago está listo");
                    },
                },
            });
        }
    } else {
        console.error("MercadoPago SDK no cargado");
    }
});
