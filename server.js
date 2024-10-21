require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Serve static files from the React app
app.use(express.static('public'));

// Endpoint to fetch the Stripe publishable key
app.get('/config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

app.get('/products', async (req, res) => {
  try {
    const products = await stripe.products.list();
    const prices = await stripe.prices.list();
    
    const packages = products.data.map(product => {
      const price = prices.data.find(p => p.product === product.id);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: price ? price.unit_amount / 100 : 0, 
      };
    });

    res.json(packages);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send('Error fetching products');
  }
});





app.post('/create-payment-intent', async (req, res) => {
  const { currency, paymentMethodType, packageId } = req.body; 

  // Validate input
  if (!currency || !paymentMethodType || !packageId) {
    return res.status(400).send('Missing required fields');
  }

  try {
    // Fetch the product to get the default price ID
    const product = await stripe.products.retrieve(packageId);
    const priceId = product.default_price;
  

    // Retrieve the price details using the default price ID
    const price = await stripe.prices.retrieve(priceId);
    console.log("Price "+price);
    

    if (!price || !price.unit_amount) {
      return res.status(404).send('Price not found or unit_amount is missing');
    }

    // Create the payment intent with the retrieved unit_amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price.unit_amount, // Use the unit_amount from the price object
      currency,
      payment_method_types: [paymentMethodType],
      description: `Payment for package ID: ${packageId}`,
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).send('Error creating payment intent');
  }
});


app.get('/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));