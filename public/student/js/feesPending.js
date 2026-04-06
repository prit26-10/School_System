let paymentDetails = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchFeesStatus();
});

async function fetchFeesStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const res = await fetch('/api/student-fees/status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401 || res.status === 403) {
            window.location.href = '/login';
            return;
        }

        const result = await res.json();
        
        if (result.success && result.data) {
            paymentDetails = result.data;
            
            // If already paid, take them immediately to dashboard
            if (paymentDetails.feesStatus === 'paid' || (paymentDetails.totalFees - paymentDetails.paidAmount) <= 0) {
                
                // Update local token payload data workaround
                let userData = JSON.parse(localStorage.getItem('userData') || '{}');
                userData.feesStatus = 'paid';
                localStorage.setItem('userData', JSON.stringify(userData));

                window.location.href = '/student/dashboard';
                return;
            }

            renderFeesCard(paymentDetails);
        } else {
            showError("Failed to fetch fees details.");
        }
    } catch (err) {
        console.error("Error fetching fees:", err);
        showError("Network error. Please try again.");
    }
}

function renderFeesCard(data) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('fees-card').style.display = 'block';

    // Add null checks for all elements
    const studentNameEl = document.getElementById('fp-student-name');
    const classNameEl = document.getElementById('fp-class-name');
    const totalFeesEl = document.getElementById('fp-total-fees');
    
    if (studentNameEl) studentNameEl.textContent = data.studentName || 'N/A';
    if (classNameEl) classNameEl.textContent = data.className || 'N/A';
    if (totalFeesEl) totalFeesEl.textContent = `₹${data.totalFees || 0}`;
}

function showError(msg) {
    document.getElementById('loading').innerHTML = `<span style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> ${msg}</span>`;
}

async function initiatePayment() {
    const btn = document.getElementById('pay-now-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    const token = localStorage.getItem('token');

    try {
        // 1. Create order
        const orderRes = await fetch('/api/student-fees/create-order', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const orderData = await orderRes.json();
        
        if (!orderData.success) {
            throw new Error(orderData.message || "Failed to create order");
        }

        // 2. Open Razorpay Checkout with proper configuration
        const startOptions = {
            key: orderData.data.keyId,
            amount: orderData.data.amount,
            currency: orderData.data.currency,
            name: "Smart School System",
            description: `Class Fees Payment - ${paymentDetails.className}`,
            image: "https://www.shutterstock.com/image-vector/school-management-system-logo-design-260nw-2187319985.jpg",
            order_id: orderData.data.orderId,
            handler: async function (response) {
                // 3. Verify Payment
                await verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
            },
            prefill: {
                name: orderData.data.studentName,
                email: orderData.data.studentEmail,
                contact: orderData.data.contact || "9999999999"
            },
            notes: {
                "student_id": paymentDetails.paymentRecordId,
                "class": paymentDetails.className
            },
            theme: {
                color: "#0A66FF"
            },
            modal: {
                ondismiss: function() {
                    btn.disabled = false;
                    btn.innerHTML = `<i class="fas fa-credit-card"></i> Pay Now Securely`;
                },
                escape: true,
                handleback: true
            }
        };

        const rzp = new Razorpay(startOptions);
        rzp.open();

    } catch (err) {
        console.error('Payment Error:', err);
        
        let errorMessage = 'Payment initiation failed';
        if (err.error && err.error.description) {
            errorMessage = err.error.description;
        } else if (err.message) {
            errorMessage = err.message;
        }
        
        // Show user-friendly error message
        if (errorMessage.includes('International') || errorMessage.includes('not supported')) {
            errorMessage = 'Please use Indian debit/credit cards, UPI, or net banking for payment.';
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
        }
        
        alert(errorMessage);
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-credit-card"></i> Pay Now Securely`;
    }
}

async function verifyPayment(orderId, paymentId, signature) {
    const btn = document.getElementById('pay-now-btn');
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Verifying...`;
    
    const token = localStorage.getItem('token');

    try {
        const verifyRes = await fetch('/api/student-fees/verify-payment', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                razorpay_order_id: orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature
            })
        });

        const result = await verifyRes.json();
        
        if (result.success) {
            // Update local user data
            let userData = JSON.parse(localStorage.getItem('userData') || '{}');
            userData.feesStatus = 'paid';
            localStorage.setItem('userData', JSON.stringify(userData));

            btn.innerHTML = `<i class="fas fa-check"></i> Payment Successful! Redirecting...`;
            btn.style.background = "#10b981";
            
            setTimeout(() => {
                window.location.href = '/student/dashboard';
            }, 2000);
        } else {
            throw new Error(result.message || "Payment verification failed");
        }
    } catch (err) {
        console.error('Payment Verification Error:', err);
        
        let errorMessage = 'Payment verification failed';
        if (err.error && err.error.description) {
            errorMessage = err.error.description;
        } else if (err.message) {
            errorMessage = err.message;
        }
        
        alert(errorMessage + '. Please contact admin if amount was deducted.');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-credit-card"></i> Pay Now Securely`;
    }
}
