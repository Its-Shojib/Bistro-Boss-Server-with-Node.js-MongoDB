const express = require('express')
const app = express()
const port = process.env.PORT || 5000

app.get('/', (req, res) => {
  res.send('Bistrooo Bossss is Running!')
})

app.listen(port, () => {
  console.log(`Bistro Boss is listening on port ${port}`)
})