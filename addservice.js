import { db, storage } from './firebase-config.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
    const serviceForm = document.getElementById('serviceForm');
    const messageDiv = document.getElementById('message');

    serviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form values
        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const imageFile = document.getElementById('image').files[0];
        
        // Validate inputs
        if (!title || !description || !imageFile) {
            showMessage('Please fill all fields!', 'error');
            return;
        }

        try {
            // Disable submit button during processing
            const submitBtn = serviceForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';

            // Upload image to Firebase Storage
            const storageRef = ref(storage, `service-images/${Date.now()}_${imageFile.name}`);
            const snapshot = await uploadBytes(storageRef, imageFile);
            const imageUrl = await getDownloadURL(snapshot.ref);

            // Save data to Firestore
            await addDoc(collection(db, "services"), {
                title,
                description,
                imageUrl,
                createdAt: Timestamp.fromDate(new Date())
            });

            // Reset form and show success message
            serviceForm.reset();
            showMessage('Service added successfully!', 'success');
        } catch (error) {
            console.error("Error adding service: ", error);
            showMessage(`Error: ${error.message}`, 'error');
        } finally {
            // Re-enable submit button
            const submitBtn = serviceForm.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Service';
        }
    });

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = type;
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = '';
        }, 3000);
    }
});
