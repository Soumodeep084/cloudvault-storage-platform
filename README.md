# ☁️ CloudVault – Smart File Sharing & Backup Platform

CloudVault is a cloud-based web application that allows users to upload, manage, and securely share files. It demonstrates real-world cloud computing concepts using AWS services.

---

## 🚀 Features

* 🔐 User Authentication (Clerk)
* 📤 File Upload & Storage
* 📥 File Download
* 🔗 Secure File Sharing via Link
* 🕓 Version History Management
* 📊 Admin Dashboard
* ☁️ Cloud Backup System

---

## 🏗️ Tech Stack

### Frontend

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* Clerk Authentication

### Cloud (AWS)

* Amazon EC2 (IaaS)
* AWS Elastic Beanstalk (PaaS)
* Amazon RDS (DBaaS)
* Amazon S3 (Storage-as-a-Service)
* AWS IAM & AWS WAF (Security-as-a-Service)

---

## ☁️ AWS Architecture

User → Next.js App → AWS Services

* Files stored in Amazon S3
* User data stored in Amazon RDS
* Backend hosted on EC2 / Elastic Beanstalk
* Authentication secured via Clerk & AWS IAM

---

## 📂 Project Structure



---

## ⚙️ Installation

```bash
git clone https://github.com/Soumodeep084/cloudvault-aws-file-sharing.git
cd cloudvault-aws-file-sharing
npm install
npm run dev
```

---

## 🔐 Environment Variables

Create a `.env` file:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret
DATABASE_URL=your_rds_url
AWS_ACCESS_KEY=your_aws_key
AWS_SECRET_KEY=your_aws_secret
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your_bucket
```

---

## 📸 Screenshots

(Add screenshots here for submission)

---

## 🎯 Cloud Concepts Covered

| Cloud Model           | Implementation        |
| --------------------- | --------------------- |
| IaaS                  | Amazon EC2            |
| PaaS                  | AWS Elastic Beanstalk |
| DBaaS                 | Amazon RDS            |
| Storage as a Service  | Amazon S3             |
| Security as a Service | AWS IAM               |

---

## 📌 Future Enhancements

* Real-time collaboration
* File encryption
* AI-based file categorization
* Mobile app support

---

## 👨‍💻 Author

Soumodeep Dutta , Valentino Gomes

---

## 📄 License

This project is for educational purposes.
