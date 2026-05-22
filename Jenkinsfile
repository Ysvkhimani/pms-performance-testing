pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                git 'https://github.com/Ysvkhimani/pms-performance-testing`'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Run Planning Module Test') {
            steps {
                sh 'k6 run scripts/planning-module.js'
            }
        }

        stage('Run Quality Module Test') {
            steps {
                sh 'k6 run scripts/quality-module.js'
            }
        }

        stage('Run Project Module Test') {
            steps {
                sh 'k6 run scripts/project-module.js'
            }
        }
    }
}