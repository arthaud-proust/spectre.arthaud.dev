class BiometricAuth {
    static PRF_INFO = new TextEncoder().encode('spectre.arthaud.dev/biometric');

    static async isSupported() {
        if (!window.PublicKeyCredential) {
            console.log('[Biometric] PublicKeyCredential indisponible');
            return false;
        }
        if (!window.crypto?.subtle) {
            console.log('[Biometric] crypto.subtle indisponible (contexte non sécurisé ?)');
            return false;
        }
        if (!window.isSecureContext) {
            console.log('[Biometric] Page non servie en contexte sécurisé (HTTPS ou localhost requis)');
            return false;
        }
        try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (!available) {
                console.log("[Biometric] Pas d'authentificateur plateforme disponible (authentification biométrique désactivée ?)");
            }
            return available;
        } catch (e) {
            console.warn('[Biometric] Détection support a échoué :', e);
            return false;
        }
    }

    static b64urlEncode(buffer) {
        const bytes = new Uint8Array(buffer);
        let str = '';
        for (const b of bytes) str += String.fromCharCode(b);
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    static b64urlDecode(str) {
        const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
        const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
    }

    async register(userName) {
        const prfSalt = crypto.getRandomValues(new Uint8Array(32));
        const userId = crypto.getRandomValues(new Uint8Array(16));
        const challenge = crypto.getRandomValues(new Uint8Array(32));

        const credential = await navigator.credentials.create({
            publicKey: {
                rp: { id: location.hostname, name: 'Spectre' },
                user: {
                    id: userId,
                    name: userName || 'spectre-user',
                    displayName: userName || 'Spectre user',
                },
                challenge,
                pubKeyCredParams: [
                    { type: 'public-key', alg: -7 },
                    { type: 'public-key', alg: -257 },
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'required',
                },
                timeout: 60000,
                extensions: { prf: {} },
            },
        });

        if (!credential) throw new Error('Aucun credential créé');

        const ext = credential.getClientExtensionResults?.() ?? {};
        console.log('[Biometric] Résultat création — extensions:', ext,
            '— authenticatorAttachment:', credential.authenticatorAttachment);

        if (ext.prf?.enabled === false) {
            throw new Error(
                "L'authentificateur choisi ne supporte pas PRF. "
                + "Vérifiez qu'iCloud Keychain est activé (Réglages Système → Apple ID → iCloud → Trousseau)."
            );
        }

        const credentialId = BiometricAuth.b64urlEncode(credential.rawId);
        const prfSaltB64 = BiometricAuth.b64urlEncode(prfSalt);

        const prfOutput = await this.assert(credentialId, prfSaltB64);

        return { credentialId, prfSalt: prfSaltB64, prfOutput };
    }

    async assert(credentialIdB64, prfSaltB64) {
        const credentialId = BiometricAuth.b64urlDecode(credentialIdB64);
        const prfSalt = new Uint8Array(BiometricAuth.b64urlDecode(prfSaltB64));
        const challenge = crypto.getRandomValues(new Uint8Array(32));

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                rpId: location.hostname,
                allowCredentials: [{ type: 'public-key', id: credentialId }],
                userVerification: 'required',
                timeout: 60000,
                extensions: { prf: { eval: { first: prfSalt } } },
            },
        });

        if (!assertion) throw new Error('Aucune assertion reçue');

        const ext = assertion.getClientExtensionResults?.() ?? {};
        console.log('[Biometric] Résultat assertion — extensions:', ext);

        const prfOutput = ext.prf?.results?.first;
        if (!prfOutput) {
            throw new Error(
                "L'authentificateur n'a pas renvoyé de valeur PRF. "
                + "Vérifiez qu'iCloud Keychain est activé."
            );
        }

        return prfOutput;
    }

    async deriveKey(prfOutput) {
        return crypto.subtle.importKey(
            'raw',
            prfOutput,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt'],
        );
    }

    async encryptSecret(plaintext, prfOutput) {
        const key = await this.deriveKey(prfOutput);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = new TextEncoder().encode(plaintext);
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
        return {
            ciphertext: BiometricAuth.b64urlEncode(ciphertext),
            iv: BiometricAuth.b64urlEncode(iv),
        };
    }

    async decryptSecret(ciphertextB64, ivB64, prfOutput) {
        const key = await this.deriveKey(prfOutput);
        const iv = BiometricAuth.b64urlDecode(ivB64);
        const ciphertext = BiometricAuth.b64urlDecode(ciphertextB64);
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(plaintext);
    }
}
