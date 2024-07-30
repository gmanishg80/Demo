exports.subscription = [
    async (req, res) => {
        try {

            const { email, name } = req.body;

            const customer = await Stripe.customers.create({ email: email, name: name });
            if (!customer) return res.status(404).json({ error: 'Customer not created' });

            //  let USER Model in required
            const addCustomerToDb = await User.findOneUpdate({ email: email }, { customer: customer.id }, { new: true })
            if (!addCustomerToDb) return res.status(404).json({ error: 'Customer not updated' });


            const subscription = await stripe.subscriptions.create({
                customer: customer_id,
                items: [{ price: price_id }],
                trial_end: 1610403705,
                
            });


            const paymentMethod = await Stripe.paymentMethods.create({
                type: "card",
                card: {
                    number: "123456765456",
                    exp_month: 9,
                    exp_year: 2024,
                    cvc: "123"
                }
            });

            const customerID = req.body.customerId;
            await stripe.paymentMethods.attach(paymentMethod.id, {
                customer: customerID
            });



            const paymenyIntent = await stripe.paymentIntents.create({   //latest
                amount: 1000,
                currency: "usd",
                payment_method: paymentMethodID,
                confirm: true,
                customer: customerID,

            })
            res.json(paymentIntent);




            //add and save card
            const {customeID} = req.body;
            const addCard = await Stripe.tokens.create({
                card: {
                    number: "123456765456",
                    exp_month: 9,
                    exp_year: 2024,
                    cvc: "123"
                }
            });
            //attaching the card to the customer
            const card = await stripe.card.createSource(customerID,{
                source:addCard.id
            });

            req.json(card);





            //list payment lists
            const {customerID} = req.body;

            const paymentMethods = await stripe.paymentMethods.list({
                customerID:customerID,
                type:"card"
            })

            res.json(paymentMethod.data);

        } catch (error) {
            console.log(error.message, "subscription Failed")
        }
    }
]