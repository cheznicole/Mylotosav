# **App Name**: Loto Bonheur Predict

## Core Features:

- Results Display: Display lottery results fetched from the Lotobonheur.ci API, including date, winning numbers, and machine numbers.
- Co-occurrence Matrix: Show the frequency of each number appearing with other numbers in the same or subsequent draws.
- Statistical Analysis: Present number frequency analysis, with filters for most and least frequent numbers, in an interactive and visually appealing manner.
- AI-Powered Prediction: Generate predictions for future draws using a pre-trained hybrid XGBoost + RNN-LSTM model. Display a confidence score or probability for each predicted number using a simple Bayesian analysis tool.
- Color-Coded Numbers: Color code numbers in the display to match loto-bonheur's specifications for each ten range.
- Implémentation de l'API TypeScript: Below, the adapted TypeScript version of the web scraping code provided, to be used in the backend API service.

## Style Guidelines:

- Primary color: A vibrant saffron (#FFC133), evoking a sense of optimism and prosperity, suitable for lottery apps. Saffron sits comfortably in the yellow hue range of the color spectrum and alludes to wealth and happiness.
- Background color: Light, desaturated yellow (#F8F8EE), providing a soft, neutral backdrop that ensures readability and reduces eye strain.
- Accent color: A complementary golden orange (#E0A227), used for interactive elements and important highlights, offering a touch of sophistication.
- Ensure high readability and maintainability by sticking to system fonts
- Minimalist and clear icons to represent different sections (Data, Consult, Statistics, Prediction), ensuring easy navigation.
- A clean, responsive layout with clearly defined sections for each feature, using Tailwind CSS grid and flexbox for optimal arrangement on various devices.
- Subtle transitions and animations for loading data and displaying predictions to provide a smooth and engaging user experience.