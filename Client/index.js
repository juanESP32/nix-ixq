window.addEventListener("load", function () {
    if (typeof MercadoPago !== "undefined") {
        const mp = new MercadoPago('APP_USR-84817fc5-5c0c-4ecb-b68e-b9174b2aa96d', {
            locale: 'es-AR'
        });

        // Selecciona todos los botones con la clase "checkout-btn"
        const checkoutButtons = document.querySelectorAll(".checkout-btn");

        // Agrega un evento "click" a cada botón
        checkoutButtons.forEach((button) => {
            button.addEventListener("click", function () {
                // Deshabilita el botón para evitar múltiples clics
                button.disabled = true;

                // Obtén los datos del producto desde los atributos del botón
                const description = button.getAttribute("data-description");
                const price = parseFloat(button.getAttribute("data-price"));
                const quantity = parseInt(button.getAttribute("data-quantity"));

                // Crea el objeto de datos del pedido
                const orderData = {
                    description,
                    price,
                    quantity,
                };

                console.log("Datos enviados al servidor:", orderData);

                // Realiza la solicitud al servidor
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
                        console.error("El servidor no devolvió un id válido:", preference);
                        alert("No se pudo generar la preferencia de pago.");
                        button.disabled = false; // Habilita el botón si ocurre un error
                        return;
                    }
                    createCheckoutButton(preference.id, button);
                })
                .catch((error) => {
                    console.error("Error en la solicitud:", error);
                    alert("Error al comunicarse con el servidor.");
                    button.disabled = false; // Habilita el botón si ocurre un error
                });
            });
        });

        function createCheckoutButton(preferenceId, button) {
            const bricksBuilder = mp.bricks();

            const renderComponent = async () => {
                try {
                    // Desmonta cualquier botón existente
                    if (window.checkoutButton) {
                        window.checkoutButton.unmount();
                        window.checkoutButton = null; // Limpia la referencia
                    }

                    // Renderiza el botón de pago
                    window.checkoutButton = await bricksBuilder.create("wallet", "button-checkout", {
                        initialization: { preferenceId },
                        callbacks: {
                            onError: (error) => {
                                console.error("Error en el pago:", error);
                                button.disabled = false; // Habilita el botón si ocurre un error
                            },
                            onReady: () => {
                                console.log("El botón de pago está listo");
                            },
                        },
                    });
                } catch (error) {
                    console.error("Error al renderizar el botón de pago:", error);
                    button.disabled = false; // Habilita el botón si ocurre un error
                }
            };

            renderComponent();
        }
    } else {
        console.error("MercadoPago SDK no cargado");
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const productCards = document.querySelectorAll(".product-card");

    productCards.forEach((card) => {
        card.addEventListener("click", () => {
            // Quitar la clase 'selected' de todos los productos
            productCards.forEach((c) => c.classList.remove("selected"));
            // Agregar la clase 'selected' al producto clicado
            card.classList.add("selected");
        });
    });
});

