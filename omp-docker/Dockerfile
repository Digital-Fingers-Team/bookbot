FROM php:8.2-apache

# --- System packages needed to build PHP extensions ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libxml2-dev \
        libonig-dev \
        libcurl4-openssl-dev \
        libxslt1-dev \
        zlib1g-dev \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# --- PHP extensions required by OMP 3.5 ---
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        intl \
        mbstring \
        mysqli \
        pdo_mysql \
        zip \
        exif \
        ftp \
        xsl \
        opcache

# --- Apache: enable rewrite + allow .htaccess overrides ---
RUN a2enmod rewrite
RUN sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf || true

# --- PHP runtime tuning suitable for OMP (large uploads, etc.) ---
RUN { \
        echo 'memory_limit = 512M'; \
        echo 'upload_max_filesize = 256M'; \
        echo 'post_max_size = 256M'; \
        echo 'max_execution_time = 300'; \
        echo 'file_uploads = On'; \
    } > /usr/local/etc/php/conf.d/omp.ini

# OMP source is bind-mounted at /var/www/html via docker-compose.
WORKDIR /var/www/html
