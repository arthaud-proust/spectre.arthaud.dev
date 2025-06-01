class LocalSave {
    key = 'spectre'

    remember(userName, secret, algorithm) {
        localStorage.setItem(this.key, JSON.stringify({userName, secret, algorithm}));
    }
    
    forget() {
        localStorage.removeItem(this.key);
    }
    
    retrieve() { 
        return JSON.parse(localStorage.getItem(this.key)) ?? {};
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

    const site = document.getElementById('site');
    const siteForm = site.querySelector('form');
    const siteNameInput = site.querySelector('[name="siteName"]');
    const sitePurposeInputs = site.querySelectorAll('[name="sitePurpose"]');
    const siteCounterInput = site.querySelector('[name="siteCounter"]');
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
    
    for (template of templatesOrder) {
        const option = document.createElement('option');
        option.text = spectre.resultName[template];
        option.value = template;
        siteTypeInput.appendChild(option);
    }
    for (option of sitePurposeInputs) {
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
            siteNameInput.focus()
        } else {
            user.setAttribute("aria-hidden", false);
            site.setAttribute("aria-hidden", true);
            userAlgorithmInput.value = spectre.algorithm.current;
            siteNameInput.value = null;
            userNameInput.focus()
        }
    }

    updateDefaults();
    spectre.observers.push(updateView);
    updateView();

    const retrieved = localSave.retrieve();
    if(retrieved.userName && retrieved.secret && retrieved.algorithm) {
        spectre.authenticate(retrieved.userName, retrieved.secret, retrieved.algorithm);
    }

    userSecretToggleRevealButton.addEventListener('click', () => {
        const isPassword = userSecretInput.type === 'password';
        userSecretInput.type = isPassword ? 'text' : 'password';

        userSecretToggleRevealButton.querySelector('i:first-of-type').setAttribute('aria-hidden', isPassword);
        userSecretToggleRevealButton.querySelector('i:last-of-type').setAttribute('aria-hidden', !isPassword);
    });

    userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (userRememberMeCheckbox.checked) {
            localSave.remember(userNameInput.value, userSecretInput.value, userAlgorithmInput.value);
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
        localSave.forget();
    });
});
