import nodemailer from "nodemailer";
import { User } from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

async function userContactUs(req, res, next) {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(402).json({
        message: "All fields are required",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSKEY,
      },
    });

    const mailOptions = {
      from: `"Contact Us Form" from QuickBgRemove`, // Sender's email
      to: process.env.Reciever_Email, // Admin's email (your receiving email)
      subject: "New Contact Form Submission QuickBgRemove",
      html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #333; text-align: center;">New Contact Form Submission</h2>
                <hr style="border: none; border-bottom: 1px solid #ddd; margin-bottom: 20px;">
                <p style="font-size: 16px; color: #555;"><strong>Name:</strong> ${name}</p>
                <p style="font-size: 16px; color: #555;"><strong>Email:</strong> ${email}</p>
                <p style="font-size: 16px; color: #555;"><strong>Message:</strong></p>
                <div style="background-color: #f9f9f9; padding: 10px; border-left: 4px solid #007bff;">
                  <p style="font-size: 14px; color: #333;">${message}</p>
                </div>
                <hr style="border: none; border-bottom: 1px solid #ddd; margin-top: 20px;">
                <p style="text-align: center; font-size: 12px; color: #888;">This email was automatically generated by your website's contact form.</p>
              </div>
            `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "Email sent successfully",
    });
  } catch (error) {
    return next(error);
  }
}
async function userRegister(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(402).json({
        message: "All fields are required",
      });
    }

    const checkEmailAlreadyExist = await User.find({ email });
    if (checkEmailAlreadyExist) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }
    const hashedPassword = bcryptjs.hashSync(10, password);

    const tokenVerification = jwt.sign(email);
  } catch (error) {
    return next(error);
  }
}
async function userLogin(req, res) {}

export { userRegister, userContactUs, userLogin };
