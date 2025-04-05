window.addEventListener("load", function () {
    if (typeof MercadoPago !== "undefined") {
        const mp = new MercadoPago('APP_USR-84817fc5-5c0c-4ecb-b68e-b9174b2aa96d', {
            locale: 'es-AR'
        });

        document.getElementById("checkout-btn").addEventListener("click", function () {
            const checkoutButton = document.getElementById("checkout-btn");
            checkoutButton.disabled = true; // Deshabilita el botón para evitar múltiples clics

            const orderData = {
                quantity: parseInt(document.getElementById("quantity").innerText),
                description: document.getElementById("product-description").innerText,
                price: parseFloat(document.getElementById("unit-price").innerText),
            };

            console.log("Datos enviados al servidor:", orderData); // Verifica los datos enviados

            fetch("https://electronica2-maquina-expendedora.onrender.com/create_preference", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(orderData),
            })
            .then(response => response.json())
            .then(preference => {
                console.log("Respuesta del servidor:", preference); // Verifica la respuesta del servidor
                if (!preference.id) {
                    console.error("El servidor no devolvió un id válido:", preference);
                    alert("No se pudo generar la preferencia de pago.");
                    checkoutButton.disabled = false; // Habilita el botón si ocurre un error
                    return;
                }
                createCheckoutButton(preference.id);
            })
            .catch(error => {
                console.error("Error en la solicitud:", error);
                alert("Error al comunicarse con el servidor.");
                checkoutButton.disabled = false; // Habilita el botón si ocurre un error
            });
        });

        function createCheckoutButton(preferenceId) {
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
                                document.getElementById("checkout-btn").disabled = false; // Habilita el botón si ocurre un error
                            },
                            onReady: () => {
                                console.log("El botón de pago está listo");
                            },
                        },
                    });
                } catch (error) {
                    console.error("Error al renderizar el botón de pago:", error);
                    document.getElementById("checkout-btn").disabled = false; // Habilita el botón si ocurre un error
                }
            };

            renderComponent();
        }
    } else {
        console.error("MercadoPago SDK no cargado");
    }
});
