class LocalSave {
    key = 'spectre'

    _read() {
        const data = JSON.parse(localStorage.getItem(this.key)) ?? {};
        if (data.biometric) {
            data.identities = data.identities ?? [];
            data.identities.push({
                userName: data.userName,
                algorithm: data.algorithm,
                ...data.biometric,
            });
            delete data.biometric;
            this._write(data);
        }
        return data;
    }

    _write(data) {
        if (!data.userName && !data.algorithm && (!data.identities || data.identities.length === 0)) {
            localStorage.removeItem(this.key);
        } else {
            localStorage.setItem(this.key, JSON.stringify(data));
        }
    }

    remember(userName, algorithm) {
        const data = this._read();
        data.userName = userName;
        data.algorithm = algorithm;
        this._write(data);
    }

    forget() {
        const data = this._read();
        delete data.userName;
        delete data.algorithm;
        this._write(data);
    }

    retrieve() {
        const data = this._read();
        return { userName: data.userName, algorithm: data.algorithm };
    }

    getIdentities() {
        return this._read().identities ?? [];
    }

    saveIdentity(identity) {
        const data = this._read();
        data.identities = (data.identities ?? []).filter(i => i.userName !== identity.userName);
        data.identities.push(identity);
        this._write(data);
    }

    removeIdentity(userName) {
        const data = this._read();
        if (!data.identities) return;
        data.identities = data.identities.filter(i => i.userName !== userName);
        if (data.identities.length === 0) delete data.identities;
        this._write(data);
    }

    findIdentity(userName) {
        return this.getIdentities().find(i => i.userName === userName) ?? null;
    }
}

const templatesOrder = Object.freeze([
    spectre.resultType.templateMaximum,
    spectre.resultType.templateLong,
    spectre.resultType.templateMedium,
    spectre.resultType.templateShort,
    spectre.resultType.templateBasic,
    spectre.resultType.templateLongBasic,
    spectre.resultType.templatePIN,
    spectre.resultType.templateName,
    spectre.resultType.templatePhrase,
]);

window.addEventListener('DOMContentLoaded', () => {
    const localSave = new LocalSave();
    
    const main = document.querySelector('main');

    const user = document.getElementById('user');
    const userForm = user.querySelector('form');
    const userNameInput = user.querySelector('[name="userName"]');
    const userSecretInput = user.querySelector('[name="userSecret"]');
    const userSecretToggleRevealButton = user.querySelector('#userSecretContainer > button');
    const userAlgorithmInput = user.querySelector('[name="algorithmVersion"]');
    const userRememberMeCheckbox = user.querySelector('[name="rememberMe"]');
    const useBiometricCheckbox = user.querySelector('[name="useBiometric"]');
    const useBiometricLabel = document.getElementById('useBiometric-label');

    const identicon = document.getElementById('identicon');
    const identiconAccessory = identicon.querySelector('.accessory');
    const identiconLeftArm = identicon.querySelector('.leftArm');
    const identiconBody = identicon.querySelector('.body');
    const identiconRightArm = identicon.querySelector('.rightArm');

    const site = document.getElementById('site');
    const siteForm = site.querySelector('form');
    const siteNameInput = site.querySelector('[name="siteName"]');
    const sitePurposeInputs = site.querySelectorAll('[name="sitePurpose"]');
    const siteCounterInput = site.querySelector('[name="siteCounter"]');
    const siteCounterIncrementButton = site.querySelector('#siteCounter-increment');
    const siteCounterDecrementButton = site.querySelector('#siteCounter-decrement');
    const siteTypeInput = site.querySelector('[name="siteType"]');
    const siteResult = site.querySelector('#siteResult');
    const siteResultToggleRevealButton = siteResult.querySelector('button[type="button"]');
    const siteResultButton = siteResult.querySelector('button[type="submit"]');
    const siteResultInput = siteResultButton.querySelector('input');
    const siteResultCopied = site.querySelector('#siteResultCopied');
    
    const signOutButton = document.getElementById('signout');

    function getSelectedPurposeInput () {
        return Array.from(sitePurposeInputs).find(el=>el.checked);
    }
    
    for (const template of templatesOrder) {
        const option = document.createElement('option');
        option.text = spectre.resultName[template];
        option.value = template;
        siteTypeInput.appendChild(option);
    }
    for (const option of sitePurposeInputs) {
        option.checked = option.value === spectre.purpose.authentication;
    }

    function updateDefaults() {
        userAlgorithmInput.value = spectre.algorithm.current;
        siteCounterInput.value = spectre.counter.initial;
        
        switch (getSelectedPurposeInput()?.value) {
            case spectre.purpose.authentication: {
                siteTypeInput.value = spectre.resultType.defaultPassword;
                break;
            }
            case spectre.purpose.identification: {
                siteTypeInput.value = spectre.resultType.defaultLogin;
                break;
            }
            case spectre.purpose.recovery: {
                siteTypeInput.value = spectre.resultType.defaultAnswer;
                break;
            }
        }
    }

    function updateSpectre() {
        spectre.request(
            siteNameInput.value,
            siteTypeInput.value,
            siteCounterInput.value,
            getSelectedPurposeInput()?.value,
            null //keyContext
        );
    }

    function updateView() {
        main.dataset.loading = spectre.operations.user.pending || spectre.operations.site.pending;

        userNameInput.value = spectre.operations.user.userName;
        userSecretInput.value = null;

        
        const result = spectre.result(siteNameInput.value, getSelectedPurposeInput()?.value);
        siteResult.classList.toggle("empty", result == null);
        siteResultInput.value = result ?? "";

        if (spectre.operations.user.authenticated) {
            user.setAttribute("aria-hidden", true);
            site.setAttribute("aria-hidden", false);
            updateIdenticon(spectre.operations.user.identicon)
            siteNameInput.focus()
        } else {
            user.setAttribute("aria-hidden", false);
            site.setAttribute("aria-hidden", true);
            siteNameInput.value = null;

            const retrieved = localSave.retrieve();
            userNameInput.value = retrieved.userName ?? ""
            userAlgorithmInput.value = retrieved.algorithm ?? spectre.algorithm.current;

            if(retrieved.userName && retrieved.algorithm) {
                userRememberMeCheckbox.checked = true
            }

            if(userNameInput.value !== "") {
                userSecretInput.focus()
            } else {
                userNameInput.focus()
            }
        }
    }

    function updateIdenticon(identiconValue) {
        identicon.style.setProperty("--identicon-color", identiconValue.color);
        identiconAccessory.innerText = identiconValue.accessory
        identiconLeftArm.innerText = identiconValue.leftArm
        identiconBody.innerText = identiconValue.body
        identiconRightArm.innerText = identiconValue.rightArm
    }

    updateDefaults();
    spectre.observers.push(updateView);

    updateView();

    const biometric = new BiometricAuth();
    const identitiesContainer = document.getElementById('biometric-identities');
    const identitiesList = identitiesContainer.querySelector('ul');
    let pendingBiometricRegistration = null;

    function renderIdentities() {
        const identities = localSave.getIdentities();
        identitiesList.innerHTML = '';

        if (identities.length === 0) {
            identitiesContainer.hidden = true;
            return;
        }
        identitiesContainer.hidden = false;

        for (const identity of identities) {
            const li = document.createElement('li');

            const loginButton = document.createElement('button');
            loginButton.type = 'button';
            loginButton.innerHTML = '<i class="fa-duotone fa-fw fa-fingerprint"></i> ';
            loginButton.appendChild(document.createTextNode(identity.userName));
            loginButton.addEventListener('click', () => loginAsIdentity(identity));

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove';
            removeButton.title = `Supprimer l'authentification biométrique pour ${identity.userName}`;
            removeButton.innerHTML = '<i class="fa-duotone fa-fw fa-trash"></i>';
            removeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Supprimer l'authentification biométrique pour ${identity.userName} ?`)) {
                    localSave.removeIdentity(identity.userName);
                    renderIdentities();
                }
            });

            li.appendChild(loginButton);
            li.appendChild(removeButton);
            identitiesList.appendChild(li);
        }
    }

    async function loginAsIdentity(identity) {
        if (spectre.operations.user.authenticated) return;
        try {
            const prfOutput = await biometric.assert(identity.credentialId, identity.prfSalt);
            const secret = await biometric.decryptSecret(identity.encryptedSecret, identity.iv, prfOutput);
            spectre.authenticate(identity.userName, secret, identity.algorithm ?? spectre.algorithm.current);
        } catch (e) {
            console.warn('Login biométrique annulé ou échoué :', e);
            userSecretInput.focus();
        }
    }

    async function setupBiometricUI() {
        const supported = await BiometricAuth.isSupported();
        if (!supported) {
            identitiesContainer.hidden = true;
            return;
        }

        useBiometricLabel.hidden = false;
        renderIdentities();

        const identities = localSave.getIdentities();
        if (identities.length === 1) {
            await loginAsIdentity(identities[0]);
        }
    }

    spectre.observers.push(async () => {
        if (!pendingBiometricRegistration) return;
        if (!spectre.operations.user.authenticated) return;
        if (spectre.operations.user.pending) return;

        const { secret, userName, algorithm } = pendingBiometricRegistration;
        pendingBiometricRegistration = null;

        try {
            const { credentialId, prfSalt, prfOutput } = await biometric.register(userName);
            const { ciphertext, iv } = await biometric.encryptSecret(secret, prfOutput);
            localSave.saveIdentity({
                userName,
                algorithm,
                credentialId,
                prfSalt,
                encryptedSecret: ciphertext,
                iv,
            });
            renderIdentities();
        } catch (e) {
            console.error('Échec activation biométrique :', e);
            alert("Impossible d'activer l'authentification biométrique : " + (e.message ?? e));
        }
    });

    setupBiometricUI();


    const siteCounterValue = ()=>{
        const value = parseInt(siteCounterInput.value)

        return isNaN(value) ? 1 : value;
    }
    const canSiteCounterDecrement = ()=>  siteCounterValue() > 1;
    siteCounterDecrementButton.disabled = !canSiteCounterDecrement();

    siteCounterIncrementButton.addEventListener('click', () => {
        const currentValue = siteCounterValue();
        siteCounterInput.value = currentValue + 1;
        updateSpectre();

        siteCounterDecrementButton.disabled = !canSiteCounterDecrement();
    });

    siteCounterDecrementButton.addEventListener('click', () => {
        if(!canSiteCounterDecrement())  return;

        const currentValue = siteCounterValue();
        siteCounterInput.value = currentValue - 1;
        updateSpectre();

        siteCounterDecrementButton.disabled = !canSiteCounterDecrement();
    });

    userSecretToggleRevealButton.addEventListener('click', () => {
        const isPassword = userSecretInput.type === 'password';
        userSecretInput.type = isPassword ? 'text' : 'password';

        userSecretToggleRevealButton.querySelector('i:first-of-type').setAttribute('aria-hidden', isPassword);
        userSecretToggleRevealButton.querySelector('i:last-of-type').setAttribute('aria-hidden', !isPassword);
    });

    userForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (userRememberMeCheckbox.checked) {
            localSave.remember(userNameInput.value, userAlgorithmInput.value);
        }

        if (useBiometricCheckbox.checked && !localSave.findIdentity(userNameInput.value)) {
            pendingBiometricRegistration = {
                secret: userSecretInput.value,
                userName: userNameInput.value,
                algorithm: userAlgorithmInput.value,
            };
        }

        spectre.authenticate(userNameInput.value, userSecretInput.value, userAlgorithmInput.value);
    });


    siteNameInput.addEventListener('input', () => {
        updateSpectre();
    });
    sitePurposeInputs.forEach(el=>{
        el.addEventListener('input', () => {
            updateDefaults();
            updateSpectre();
        });
    });
    siteCounterInput.addEventListener('input', () => {
        updateSpectre();
    });
    siteTypeInput.addEventListener('input', () => {
        updateSpectre();
    });

    siteResultToggleRevealButton.addEventListener('click', () => {
        const isPassword = siteResultInput.type === 'password';
        siteResultInput.type = isPassword ? 'text' : 'password';

        siteResultToggleRevealButton.querySelector('i:first-of-type').setAttribute('aria-hidden', isPassword);
        siteResultToggleRevealButton.querySelector('i:last-of-type').setAttribute('aria-hidden', !isPassword);
    });

    siteForm.addEventListener('submit', (e) => {
        e.preventDefault()
       
        siteResultInput.select()
        if (navigator.clipboard.writeText(siteResultInput.value) || document.execCommand('copy')) {
            siteResultCopied.setAttribute('aria-hidden', false);
            siteResult.setAttribute('aria-hidden', true);
            setTimeout(() => {
                siteResultCopied.setAttribute('aria-hidden', true);
                siteResult.setAttribute('aria-hidden', false);
            }, 2000);
        }
    });

    signOutButton.addEventListener('click', () => {
        spectre.invalidate();
    });

    window.addEventListener('focus', ()=>{
        updateView()
    })
});