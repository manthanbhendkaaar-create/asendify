<?php
header('Content-Type: application/json');

// Response array
$response = [
    'success' => false,
    'message' => ''
];

// Check if form is submitted via POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // Get and sanitize form data
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $message = trim($_POST['message'] ?? '');
    
    // Validation
    $errors = [];
    
    // Validate name
    if (empty($name)) {
        $errors[] = 'Name is required';
    } elseif (strlen($name) < 2) {
        $errors[] = 'Name must be at least 2 characters';
    }
    
    // Validate email
    if (empty($email)) {
        $errors[] = 'Email is required';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Please enter a valid email address';
    }
    
    // Validate message
    if (empty($message)) {
        $errors[] = 'Message is required';
    } elseif (strlen($message) < 10) {
        $errors[] = 'Message must be at least 10 characters';
    }
    
    // If there are validation errors
    if (!empty($errors)) {
        $response['message'] = implode(', ', $errors);
        echo json_encode($response);
        exit;
    }
    
    // Sanitize data to prevent injection
    $name = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    $email = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
    $phone = htmlspecialchars($phone, ENT_QUOTES, 'UTF-8');
    $message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    
    // Email configuration
    $to = 'email091010@gmail.com'; // Replace with your email
    $from = $email;
    $subject = "New Project Inquiry from $name - Asendify";
    
    // Email headers
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8" . "\r\n";
    $headers .= "From: " . $from . "\r\n";
    $headers .= "Reply-To: " . $from . "\r\n";
    
    // Email body with professional formatting
    $emailBody = "
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: 'Outfit', Arial, sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            .header {
                border-bottom: 2px solid #d4af37;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                color: #050505;
                margin: 0;
                font-size: 24px;
            }
            .header p {
                color: #9a9a9a;
                margin: 5px 0 0 0;
                font-size: 14px;
            }
            .content {
                margin: 0 0 30px 0;
            }
            .info-block {
                margin-bottom: 20px;
                padding: 15px;
                background-color: #f9f9f9;
                border-left: 4px solid #d4af37;
                border-radius: 4px;
            }
            .info-block label {
                display: block;
                color: #d4af37;
                font-weight: 600;
                margin-bottom: 5px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .info-block p {
                color: #050505;
                margin: 0;
                font-size: 14px;
                line-height: 1.6;
                word-break: break-word;
            }
            .message-box {
                background-color: #fafafa;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #e0e0e0;
            }
            .message-box label {
                display: block;
                color: #d4af37;
                font-weight: 600;
                margin-bottom: 10px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .message-box p {
                color: #050505;
                margin: 0;
                font-size: 14px;
                line-height: 1.8;
                white-space: pre-wrap;
                word-break: break-word;
            }
            .footer {
                border-top: 1px solid #e0e0e0;
                padding-top: 20px;
                margin-top: 30px;
                text-align: center;
                color: #9a9a9a;
                font-size: 12px;
            }
            .cta-button {
                display: inline-block;
                background-color: #d4af37;
                color: #050505;
                padding: 12px 24px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                margin: 20px 0;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class=\"container\">
            <div class=\"header\">
                <h1>New Project Inquiry</h1>
                <p>From Asendify Contact Form</p>
            </div>
            
            <div class=\"content\">
                <div class=\"info-block\">
                    <label>Name</label>
                    <p>$name</p>
                </div>
                
                <div class=\"info-block\">
                    <label>Email</label>
                    <p>$email</p>
                </div>
                
                <div class=\"info-block\">
                    <label>Phone</label>
                    <p>" . (empty($phone) ? 'Not provided' : $phone) . "</p>
                </div>
                
                <div class=\"info-block\">
                    <label>Service Interested In</label>
                    <p>$service</p>
                </div>
                
                <div class=\"message-box\">
                    <label>Message</label>
                    <p>$message</p>
                </div>
            </div>
            
            <div class=\"footer\">
                <p>&copy; 2026 Asendify. All rights reserved.</p>
                <p style=\"margin-top: 10px;\">This is an automated message from your contact form.</p>
            </div>
        </div>
    </body>
    </html>
    ";
    
} else {
    $response['message'] = 'Invalid request method';
}

echo json_encode($response);
?>
