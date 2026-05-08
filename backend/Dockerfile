FROM node:18-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN chmod +x /app/start.sh
EXPOSE 3002
CMD ["sh", "/app/start.sh"]
